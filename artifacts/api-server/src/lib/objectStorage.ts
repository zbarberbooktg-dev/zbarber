import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

type StorageProvider = "replit" | "gcs";

/**
 * Decide which storage backend to use.
 *
 * - On Replit, the managed sidecar (default) brokers GCS credentials, so no
 *   service-account key is needed.
 * - Off Replit (e.g. a VPS), set OBJECT_STORAGE_PROVIDER=gcs and provide real
 *   Google Cloud Storage service-account credentials via either
 *   GOOGLE_APPLICATION_CREDENTIALS (path to a JSON key file) or
 *   GCS_CREDENTIALS_JSON (the JSON key inline).
 *
 * If credentials are present but the provider isn't set explicitly, we
 * auto-select "gcs" so a misconfigured-but-credentialed VPS still works.
 */
export function getStorageProvider(): StorageProvider {
  const explicit = process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase();
  if (explicit === "gcs") return "gcs";
  if (explicit === "replit") return "replit";
  if (process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return "gcs";
  }
  return "replit";
}

function createObjectStorageClient(): Storage {
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

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
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

  async getObjectEntityUploadURL(): Promise<string> {
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

  async getObjectEntityFile(objectPath: string): Promise<File> {
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
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
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

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
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
