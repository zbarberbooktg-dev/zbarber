---
name: Object storage provider (Replit sidecar vs real GCS)
description: How the API picks between the Replit-managed sidecar and a real GCS bucket.
---

`objectStorage.ts` supports two backends, selected by `getStorageProvider()`:
- **replit** (default): Storage client authenticates via the sidecar at `http://127.0.0.1:1106` (external_account token/credential URLs); URL signing POSTs to the sidecar's `/object-storage/signed-object-url`.
- **gcs**: real Google Cloud Storage with a service-account key; URL signing uses the SDK's native V4 `file.getSignedUrl()`.

Selection: `OBJECT_STORAGE_PROVIDER=gcs|replit` (explicit), else auto → `gcs` if `GCS_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` is set, else `replit`.

**Why:** On a VPS (off Replit) the sidecar doesn't exist, so both credential brokering AND URL signing must switch to a real GCS path. The sidecar's signing endpoint is the other Replit-only dependency besides credentials — both must branch together.

**How to apply:** GCS mode needs a service-account key with a private key (V4 signing) and Storage Object Admin on the bucket. Bucket layout vars (`PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`) use the same `/bucket/prefix` format in both modes — first path segment is the bucket name. Client PUTs send a content-type header but signing does NOT sign it, so any content-type is accepted. Documented in `deploy/env/api.env.example` + `deploy/README.md`.

## Smoke test
A bundled, dependency-free smoke test (`artifacts/api-server/src/scripts/storageSmoke.ts` → esbuild second entry → `dist/scripts/storageSmoke.mjs`) exercises the full cycle (presigned PUT, ACL metadata round-trip, download, public search) against whatever backend the env selects. Run with `node --env-file=<env> dist/scripts/storageSmoke.mjs` to confirm real GCS on the VPS (provider: gcs); runs on Replit too (provider: replit). Cleans up its own objects.

**esbuild gotcha:** `esbuild-plugin-pino` (used in `build.mjs`) calls `entrypoint.startsWith`, so `entryPoints` MUST be an array of plain string paths — the `{ in, out }` object form throws `entrypoint.startsWith is not a function`. Extra entries land at `dist/<relative-to-src>/...`.
