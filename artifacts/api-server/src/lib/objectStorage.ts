import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

type StorageProvider = "replit" | "gcs" | "local";

/**
 * A backend-agnostic handle to a stored object.
 * - GCS / Replit sidecar → wraps a `@google-cloud/storage` File.
 * - Local (VPS disk) → an absolute filesystem path plus its logical entity id.
 */
export type StoredObject =
  | { provider: "gcs" | "replit"; file: File }
  | { provider: "local"; entityId: string; absPath: string };

/**
 * Decide which storage backend to use.
 *
 * - On Replit, the managed sidecar (default) brokers GCS credentials, so no
 *   service-account key is needed.
 * - Off Replit (e.g. a VPS), set OBJECT_STORAGE_PROVIDER=local to store files on
 *   the server's own disk (under LOCAL_STORAGE_DIR), or =gcs to use a real Google
 *   Cloud Storage bucket (GOOGLE_APPLICATION_CREDENTIALS / GCS_CREDENTIALS_JSON).
 *
 * If a provider isn't set explicitly we auto-select: LOCAL_STORAGE_DIR ⇒ local,
 * else GCS credentials ⇒ gcs, else the Replit sidecar.
 */
export function getStorageProvider(): StorageProvider {
  const explicit = process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase();
  if (explicit === "local") return "local";
  if (explicit === "gcs") return "gcs";
  if (explicit === "replit") return "replit";
  if (process.env.LOCAL_STORAGE_DIR) return "local";
  if (process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return "gcs";
  }
  return "replit";
}

function createObjectStorageClient(): Storage {
  if (getStorageProvider() === "local") {
    // Not used by the local backend; constructed lazily-safe so importing this
    // module off-Replit doesn't require any GCS credentials.
    return new Storage();
  }

  if (getStorageProvider() === "gcs") {
    const projectId = process.env.GCS_PROJECT_ID?.trim() || undefined;
    const inlineCreds = process.env.GCS_CREDENTIALS_JSON?.trim();
    if (inlineCreds) {
      let credentials: { project_id?: string; [key: string]: unknown };
      try {
        credentials = JSON.parse(inlineCreds);
      } catch {
        throw new Error("GCS_CREDENTIALS_JSON is set but is not valid JSON");
      }
      return new Storage({
        projectId: projectId ?? credentials.project_id,
        credentials,
      });
    }
    // Fall back to Application Default Credentials, i.e. the JSON key file
    // pointed to by GOOGLE_APPLICATION_CREDENTIALS.
    return new Storage({ projectId });
  }

  // Replit-managed object storage via the sidecar (default).
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

export const objectStorageClient = createObjectStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Local (VPS disk) backend helpers
// ---------------------------------------------------------------------------

const LOCAL_UPLOAD_PATH = "/api/storage/local-upload";
const LOCAL_OBJECT_NAME_RE = /^uploads\/[0-9a-fA-F-]{36}$/;
const LOCAL_MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // matches nginx client_max_body_size

export function getLocalStorageDir(): string {
  const dir = process.env.LOCAL_STORAGE_DIR?.trim();
  if (!dir) {
    throw new Error(
      "LOCAL_STORAGE_DIR not set. Point it at a writable directory on the server " +
        "(e.g. /srv/zbarber/storage/prod) when OBJECT_STORAGE_PROVIDER=local.",
    );
  }
  return dir;
}

/** Whether an upload object name is a safe `uploads/<uuid>` path. */
export function isValidLocalUploadName(objectName: string): boolean {
  return LOCAL_OBJECT_NAME_RE.test(objectName);
}

function signLocalUpload(objectName: string, exp: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required to sign local-storage upload URLs");
  }
  return createHmac("sha256", secret).update(`${objectName}:${exp}`).digest("hex");
}

/** Verify an HMAC-signed, time-limited local upload token. */
export function verifyLocalUploadToken(
  objectName: string,
  exp: string | undefined,
  sig: string | undefined,
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  let expected: string;
  try {
    expected = signLocalUpload(objectName, expNum);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Resolve a logical entity id (e.g. "uploads/<uuid>" or "public/foo.png") to an
 * absolute path under LOCAL_STORAGE_DIR, refusing any path-traversal attempt.
 */
function resolveLocalAbsPath(entityId: string): string {
  const base = path.resolve(getLocalStorageDir());
  const abs = path.resolve(base, entityId);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new ObjectNotFoundError();
  }
  return abs;
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  /**
   * Write bytes for a local object plus a sidecar `.meta.json` (content type).
   * Accepts a Buffer or a Readable stream; enforces a max size on streams.
   */
  async putLocalObject(
    objectName: string,
    contentType: string,
    body: Readable | Buffer,
    maxBytes: number = LOCAL_MAX_UPLOAD_BYTES,
  ): Promise<void> {
    const absPath = resolveLocalAbsPath(objectName);
    await fs.promises.mkdir(path.dirname(absPath), { recursive: true });

    if (Buffer.isBuffer(body)) {
      if (body.length > maxBytes) throw new Error("Object too large");
      await fs.promises.writeFile(absPath, body);
    } else {
      await new Promise<void>((resolve, reject) => {
        let written = 0;
        let aborted = false;
        const ws = fs.createWriteStream(absPath);
        const abort = (err: Error) => {
          if (aborted) return;
          aborted = true;
          ws.destroy();
          body.destroy?.();
          fs.promises.unlink(absPath).catch(() => {});
          reject(err);
        };
        body.on("data", (chunk: Buffer) => {
          written += chunk.length;
          if (written > maxBytes) abort(new Error("Object too large"));
        });
        body.on("error", abort);
        ws.on("error", abort);
        ws.on("finish", () => {
          if (!aborted) resolve();
        });
        body.pipe(ws);
      });
    }

    await fs.promises.writeFile(
      `${absPath}.meta.json`,
      JSON.stringify({ contentType }),
    );
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    if (getStorageProvider() === "local") {
      // Confine to the `public` subtree specifically — NOT just LOCAL_STORAGE_DIR —
      // so `../uploads/<uuid>` can't escape into private uploads via this
      // unauthenticated endpoint.
      const publicRoot = path.join(path.resolve(getLocalStorageDir()), "public");
      const absPath = path.resolve(publicRoot, filePath);
      if (absPath !== publicRoot && !absPath.startsWith(publicRoot + path.sep)) {
        return null;
      }
      if (!fs.existsSync(absPath)) return null;
      return { provider: "local", entityId: `public/${filePath}`, absPath };
    }

    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return { provider: getStorageProvider() as "gcs" | "replit", file };
      }
    }

    return null;
  }

  async downloadObject(obj: StoredObject, cacheTtlSec: number = 3600): Promise<Response> {
    if (obj.provider === "local") {
      const stat = await fs.promises.stat(obj.absPath);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(
          await fs.promises.readFile(`${obj.absPath}.meta.json`, "utf8"),
        );
        if (meta?.contentType) contentType = meta.contentType as string;
      } catch {
        // No sidecar metadata — fall back to the default content type.
      }
      const nodeStream = fs.createReadStream(obj.absPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new Response(webStream, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stat.size),
          // Access is enforced at the route layer; keep caches conservative.
          "Cache-Control": `private, max-age=${cacheTtlSec}`,
        },
      });
    }

    const file = obj.file;
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  /**
   * Build an upload URL the client PUTs the file to.
   * - local → an HMAC-signed, time-limited URL pointing back at this API
   *   (requires `baseUrl`, e.g. `${req.protocol}://${req.get("host")}`).
   * - gcs / replit → a presigned object-storage URL.
   */
  async getObjectEntityUploadURL(baseUrl?: string): Promise<string> {
    if (getStorageProvider() === "local") {
      // Touch the dir env early so misconfig fails loudly at request time.
      getLocalStorageDir();
      const objectName = `uploads/${randomUUID()}`;
      const exp = Date.now() + 900_000;
      const sig = signLocalUpload(objectName, exp);
      const base = (baseUrl ?? process.env.PUBLIC_API_URL ?? "").replace(/\/+$/, "");
      if (!base) {
        throw new Error(
          "Cannot build a local upload URL: pass a baseUrl or set PUBLIC_API_URL.",
        );
      }
      return `${base}${LOCAL_UPLOAD_PATH}/${objectName}?exp=${exp}&sig=${sig}`;
    }

    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");

    if (getStorageProvider() === "local") {
      const absPath = resolveLocalAbsPath(entityId);
      if (!fs.existsSync(absPath)) {
        throw new ObjectNotFoundError();
      }
      return { provider: "local", entityId, absPath };
    }

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return { provider: getStorageProvider() as "gcs" | "replit", file: objectFile };
  }

  /**
   * List every object that lives under the private `uploads/` prefix — i.e.
   * everything created by a presigned PUT (`getObjectEntityUploadURL`). Returns
   * the normalized `/objects/...` path plus the object's creation time so a
   * caller can skip in-flight uploads. Used by the orphan-upload cleanup sweep.
   */
  async listUploadedObjects(): Promise<Array<{ objectPath: string; createdAt: Date }>> {
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const prefixPath = `${entityDir}uploads/`;
    const { bucketName, objectName: prefix } = parseObjectPath(prefixPath);
    // The portion of the bucket object name that maps to entityId="" — i.e.
    // `<private-prefix>/`. Stripping it yields the `uploads/<id>` entity id.
    const entityPrefix = prefix.slice(0, prefix.length - "uploads/".length);

    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix });

    const results: Array<{ objectPath: string; createdAt: Date }> = [];
    for (const file of files) {
      const entityId = file.name.startsWith(entityPrefix)
        ? file.name.slice(entityPrefix.length)
        : file.name;
      const timeCreated = file.metadata?.timeCreated;
      results.push({
        objectPath: `/objects/${entityId}`,
        createdAt: timeCreated ? new Date(timeCreated) : new Date(0),
      });
    }
    return results;
  }

  /**
   * Delete a single object entity by its `/objects/...` path. No-op if the
   * object no longer exists (ignoreNotFound). Used to remove orphaned uploads.
   */
  async deleteObjectByPath(objectPath: string): Promise<void> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .delete({ ignoreNotFound: true });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Local upload URLs point back at this API: .../api/storage/local-upload/<objectName>?...
    const localIdx = rawPath.indexOf(`${LOCAL_UPLOAD_PATH}/`);
    if (localIdx !== -1) {
      let pathname = rawPath;
      try {
        pathname = new URL(rawPath).pathname;
      } catch {
        pathname = rawPath.split("?")[0];
      }
      const marker = `${LOCAL_UPLOAD_PATH}/`;
      const at = pathname.indexOf(marker);
      const objectName = pathname.slice(at + marker.length);
      return `/objects/${objectName}`;
    }

    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const obj = await this.getObjectEntityFile(normalizedPath);
    if (obj.provider === "local") {
      // The local backend stores no per-object ACL; access is enforced at the
      // route layer (see routes/storage.ts).
      return normalizedPath;
    }
    await setObjectAclPolicy(obj.file, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (getStorageProvider() === "gcs") {
    const actionByMethod = {
      GET: "read",
      HEAD: "read",
      PUT: "write",
      DELETE: "delete",
    } as const;
    const [url] = await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .getSignedUrl({
        version: "v4",
        action: actionByMethod[method],
        expires: Date.now() + ttlSec * 1000,
      });
    return url;
  }

  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}
