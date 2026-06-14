/**
 * Object-storage smoke test.
 *
 * Exercises the FULL image upload + serve cycle against whatever storage
 * backend the current environment is configured for:
 *   - Replit sidecar (dev) / real GCS bucket → presigned-URL upload + ACL metadata.
 *   - local (VPS disk) → direct write under LOCAL_STORAGE_DIR + sidecar meta.
 * It uses the same `objectStorage` code the API serves with, so a green run
 * proves the live wiring (upload, download streaming, public search path) works.
 *
 * Run it on the VPS, per environment, to confirm photos upload and display:
 *
 *   node --env-file=/etc/zbarber/api-prod.env dist/storage-smoke.mjs
 *   node --env-file=/etc/zbarber/api-test.env dist/storage-smoke.mjs
 *
 * (or `set -a; source /etc/zbarber/api-prod.env; set +a` then
 *  `pnpm --filter @workspace/api-server run storage:smoke`).
 *
 * Exits 0 on success, non-zero (with a clear message) on the first failure.
 * It cleans up every object it creates.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  objectStorageClient,
  ObjectStorageService,
  getStorageProvider,
  getLocalStorageDir,
  type StoredObject,
} from "../lib/objectStorage";
import { setObjectAclPolicy, getObjectAclPolicy } from "../lib/objectAcl";

// A minimal but valid 1x1 PNG so the upload carries real image bytes.
const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000100" +
    "0000050001a5f645400000000049454e44ae426082",
  "hex",
);

function log(step: string) {
  console.log(`  • ${step}`);
}

function fail(step: string, err: unknown): never {
  console.error(`\n✗ FAILED at: ${step}`);
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
}

async function verifyDownload(svc: ObjectStorageService, obj: StoredObject): Promise<void> {
  const res = await svc.downloadObject(obj);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length !== PNG_1x1.length || !bytes.equals(PNG_1x1)) {
    throw new Error(
      `downloaded bytes differ (got ${bytes.length}, expected ${PNG_1x1.length})`,
    );
  }
  log(
    `downloaded + verified ${bytes.length} bytes (content-type ${res.headers.get("content-type")})`,
  );
}

async function runLocal(svc: ObjectStorageService): Promise<void> {
  const base = path.resolve(getLocalStorageDir());
  console.log(`  LOCAL_STORAGE_DIR: ${base}\n`);

  // ---- 1. Private entity flow (/objects/uploads/<uuid>) ----
  console.log("[1/2] Private entity write + serve (/objects/*)");
  const objectName = `uploads/${randomUUID()}`;
  const privAbs = path.join(base, objectName);
  try {
    await svc.putLocalObject(objectName, "image/png", PNG_1x1);
    log(`wrote ${objectName}`);

    const objectPath = `/objects/${objectName}`;
    const stored = await svc.getObjectEntityFile(objectPath);
    log(`object resolved on disk`);

    await verifyDownload(svc, stored);
  } catch (err) {
    fail("local private entity flow", err);
  } finally {
    await fs.promises.unlink(privAbs).catch(() => {});
    await fs.promises.unlink(`${privAbs}.meta.json`).catch(() => {});
  }
  console.log("  ✓ private entity flow OK\n");

  // ---- 2. Public search-path flow (/public-objects/*) ----
  console.log("[2/2] Public object write + serve (/public-objects/*)");
  const relName = `smoke-${Date.now()}.png`;
  const pubAbs = path.join(base, "public", relName);
  try {
    await svc.putLocalObject(`public/${relName}`, "image/png", PNG_1x1);
    log(`wrote public/${relName}`);

    const found = await svc.searchPublicObject(relName);
    if (!found) throw new Error(`searchPublicObject did not find ${relName}`);
    log("searchPublicObject located the file");

    await verifyDownload(svc, found);
  } catch (err) {
    fail("local public object flow", err);
  } finally {
    await fs.promises.unlink(pubAbs).catch(() => {});
    await fs.promises.unlink(`${pubAbs}.meta.json`).catch(() => {});
  }
  console.log("  ✓ public object flow OK\n");
}

async function runGcs(svc: ObjectStorageService): Promise<void> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR ?? "(unset)";
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "(unset)";
  console.log(`  PRIVATE_OBJECT_DIR: ${privateDir}`);
  console.log(`  PUBLIC_OBJECT_SEARCH_PATHS: ${publicPaths}\n`);

  // ---- 1. Private entity flow (the avatar / logo / gallery / realisation path) ----
  console.log("[1/2] Private entity upload + serve (/objects/*)");
  let stored: StoredObject | undefined;
  try {
    const uploadURL = await svc.getObjectEntityUploadURL();
    log("got presigned PUT url");

    const put = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: PNG_1x1,
    });
    if (!put.ok) {
      throw new Error(`PUT to presigned url failed: HTTP ${put.status} ${await put.text()}`);
    }
    log("uploaded test PNG via presigned url");

    const objectPath = svc.normalizeObjectEntityPath(uploadURL);
    log(`normalized object path: ${objectPath}`);

    stored = await svc.getObjectEntityFile(objectPath);
    log("object exists in bucket");

    if (stored.provider !== "local") {
      await setObjectAclPolicy(stored.file, { owner: "smoke-test", visibility: "public" });
      const acl = await getObjectAclPolicy(stored.file);
      if (acl?.visibility !== "public") {
        throw new Error("ACL metadata did not round-trip (expected visibility=public)");
      }
      log("ACL metadata written + read back");
    }

    await verifyDownload(svc, stored);
  } catch (err) {
    fail("private entity flow", err);
  } finally {
    if (stored && stored.provider !== "local") {
      await stored.file.delete().catch(() => {});
    }
  }
  console.log("  ✓ private entity flow OK\n");

  // ---- 2. Public search-path flow (the /public-objects/* path) ----
  console.log("[2/2] Public object upload + serve (/public-objects/*)");
  const firstPublic = svc.getPublicObjectSearchPaths()[0];
  const segments = firstPublic.replace(/^\/+/, "").split("/");
  const bucketName = segments[0];
  const prefix = segments.slice(1).join("/");
  const relName = `smoke-${Date.now()}.png`;
  const objectName = prefix ? `${prefix}/${relName}` : relName;
  const publicFile = objectStorageClient.bucket(bucketName).file(objectName);
  try {
    await publicFile.save(PNG_1x1, { contentType: "image/png" });
    log(`uploaded into public search path: ${bucketName}/${objectName}`);

    const found = await svc.searchPublicObject(relName);
    if (!found) {
      throw new Error(`searchPublicObject did not find ${relName}`);
    }
    log("searchPublicObject located the file");

    await verifyDownload(svc, found);
  } catch (err) {
    fail("public object flow", err);
  } finally {
    await publicFile.delete().catch(() => {});
  }
  console.log("  ✓ public object flow OK\n");
}

async function main() {
  const provider = getStorageProvider();
  console.log("Object-storage smoke test");
  console.log(`  provider: ${provider}\n`);

  const svc = new ObjectStorageService();

  if (provider === "local") {
    await runLocal(svc);
  } else {
    await runGcs(svc);
  }

  console.log(`✓ Storage smoke test PASSED (provider: ${provider})`);
  process.exit(0);
}

main().catch((err) => fail("unexpected", err));
