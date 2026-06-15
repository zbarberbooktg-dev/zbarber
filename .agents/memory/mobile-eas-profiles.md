---
name: Mobile EAS build profiles
description: How native store builds pick their backend, and the Clerk-key gotcha that silently breaks auth.
---

# Mobile EAS build profiles

Native (App Store / Play Store) builds are produced by EAS from `artifacts/mobile/eas.json`. Replit dev + the Replit static deploy (`scripts/build.js`) do NOT use `eas.json` — they read `REPLIT_*` at runtime.

## Single-host rule
The whole mobile app derives its backend from ONE value, `EXPO_PUBLIC_DOMAIN` (a bare host, no protocol). `apiUrl()`, `setBaseUrl`, image/storage URLs, and the panorama same-origin host all build `https://${EXPO_PUBLIC_DOMAIN}/...`. So a build profile only needs to set that one host to retarget everything.

- `production` → `api.zbarber.net`
- `test` / `preview` / `development` → `api.test.zbarber.net`

## Clerk gotcha (silently breaks auth in builds)
**Why:** the Clerk Frontend-API proxy (`clerkProxyMiddleware`, path `/api/__clerk`) is **production-only** — it no-ops for Clerk dev instances (`pk_test_`/`sk_test_`). So every store/internal build must use a real Clerk **production** publishable key, and a `pk_test_` in any backend env (e.g. `api-test.env`) breaks test-build auth even though it "works" in Replit dev (where NODE_ENV≠production bypasses the proxy).
**How to apply:** the `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` values committed in `eas.json` are placeholders (`pk_live_REPLACE_...`). They MUST be replaced before any real build or sign-in fails at runtime with no obvious server error.

## Test env reuses the PROD Clerk app (Option A)
**Why:** the test environment has no dedicated Clerk app. To avoid standing up a second Clerk production instance + proxy URL, the `test` build authenticates against the **prod** Clerk app while still hitting the **test** data API.
**How to apply:** `test` profile sets `EXPO_PUBLIC_DOMAIN=api.test.zbarber.net` (data) but `EXPO_PUBLIC_CLERK_PROXY_URL=https://api.zbarber.net/api/__clerk` (prod proxy, since the prod Clerk instance's configured proxy URL is the prod host) and the prod `pk_live_`. Backend: `api-test.env` must carry the **prod** `CLERK_SECRET_KEY`/`CLERK_PUBLISHABLE_KEY` (same `sk_live_`/`pk_live_` as `api-prod.env`) so it verifies the same tokens. Tradeoff: test sign-ups land in the **prod Clerk user pool** (no isolation). `preview`/`development` profiles carry the same constraint if used.

## App identity
`net.zbarber.app` (iOS `bundleIdentifier` + Android `package`). One identity for all profiles → `test` builds go to internal-testing / TestFlight tracks of the *same* store app, not a separate listing. Changing the id after first store upload forces a brand-new listing.
