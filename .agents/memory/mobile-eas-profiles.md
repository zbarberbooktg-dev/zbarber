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
**Why:** the Clerk Frontend-API proxy (`clerkProxyMiddleware`, path `/api/__clerk`) is **production-only** — it no-ops for Clerk dev instances. So every store/internal build must use a real Clerk **production** publishable key, and `EXPO_PUBLIC_CLERK_PROXY_URL` must be `https://<that-host>/api/__clerk`.
**How to apply:** the `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` values committed in `eas.json` are placeholders (`pk_live_REPLACE_...`). They MUST be replaced before any real build or sign-in fails at runtime with no obvious server error.

## App identity
`net.zbarber.app` (iOS `bundleIdentifier` + Android `package`). One identity for all profiles → `test` builds go to internal-testing / TestFlight tracks of the *same* store app, not a separate listing. Changing the id after first store upload forces a brand-new listing.
