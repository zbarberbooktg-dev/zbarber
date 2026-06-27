---
name: Object storage provider (local disk vs Replit sidecar vs real GCS)
description: How the API picks between local VPS disk, the Replit-managed sidecar, and a real GCS bucket.
---

`objectStorage.ts` supports THREE backends, selected by `getStorageProvider()`:
- **local**: files on the VPS's own disk under `LOCAL_STORAGE_DIR` (per-env). No cloud account, no per-GB/egress cost. RECOMMENDED on the VPS.
- **replit** (Replit dev default): Storage client authenticates via the sidecar at `http://127.0.0.1:1106`; URL signing POSTs to the sidecar's `/object-storage/signed-object-url`.
- **gcs**: real Google Cloud Storage with a service-account key; URL signing uses the SDK's native V4 `file.getSignedUrl()`.

Selection: `OBJECT_STORAGE_PROVIDER=local|gcs|replit` (explicit), else auto → `local` if `LOCAL_STORAGE_DIR` set, else `gcs` if `GCS_CREDENTIALS_JSON`/`GOOGLE_APPLICATION_CREDENTIALS` set, else `replit`.

**Key design seam — `StoredObject` union:** `getObjectEntityFile`/`searchPublicObject` return `{provider:"gcs"|"replit", file}` OR `{provider:"local", entityId, absPath}`; `downloadObject` branches on it. Routes never touch a GCS `File` directly, so adding `local` did NOT need route rewrites beyond the new upload path.

**Local upload flow (the non-obvious part):** there is no presigned cloud URL. `getObjectEntityUploadURL(baseUrl)` returns a self-URL `${baseUrl}/api/storage/local-upload/uploads/<uuid>?exp=&sig=` HMAC-signed with `SESSION_SECRET` (15-min TTL). A NON-Clerk-gated `PUT /storage/local-upload/*` route verifies the token (timing-safe), enforces objectName regex `^uploads/<uuid>$` (path-traversal guard), and streams the body to disk + a `.meta.json` sidecar (content-type). Because the upload now goes through nginx, `client_max_body_size` must be ≥ image size (25m set in deploy/nginx/api*.conf; API enforces the same cap).

**Why local needs `baseUrl` from the request:** the URL must point back at the public host. The route passes `${req.protocol}://${req.get("host")}` (works because `app.set("trust proxy",1)`). `normalizeObjectEntityPath` recognizes the local-upload URL and maps it to `/objects/uploads/<uuid>`, so the stored objectPath shape is identical to GCS — all clients (mobile imageUpload.ts, admin) stay UNCHANGED.

**Backups:** local disk has NO redundancy — backing up `LOCAL_STORAGE_DIR` is the operator's job. **ACL:** the local backend stores no per-object ACL; access is enforced entirely at the route layer (storage.ts DB-reference authz), so `objectAcl.ts` stays GCS-`File`-only and is never called on the local path.

**How to apply (GCS mode):** needs a service-account key with a private key (V4 signing) + Storage Object Admin. Bucket layout vars (`PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`) use `/bucket/prefix` format — first segment is the bucket name. Documented in `deploy/env/api.env.example` + `deploy/README.md`.

## Smoke test
A bundled smoke test (`artifacts/api-server/src/scripts/storageSmoke.ts` → esbuild second entry → `dist/scripts/storageSmoke.mjs`) is provider-aware: for **local** it does a direct disk write/read + public-search round-trip; for **gcs/replit** it does the presigned PUT + ACL round-trip. Run `node --env-file=<env> dist/scripts/storageSmoke.mjs`; prints `provider: <x>` and cleans up its own objects.

**esbuild gotcha:** `esbuild-plugin-pino` (used in `build.mjs`) calls `entrypoint.startsWith`, so `entryPoints` MUST be an array of plain string paths — the `{ in, out }` object form throws `entrypoint.startsWith is not a function`. Extra entries land at `dist/<relative-to-src>/...`.
