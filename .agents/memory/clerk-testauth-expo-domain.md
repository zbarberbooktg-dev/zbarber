---
name: Clerk test-auth cannot reach the Expo web dev domain
description: Why runTest's [Clerk Auth] programmatic sign-in fails on the mobile Expo web preview, and what to verify instead.
---

**Symptom:** `runTest({ testClerkAuth: true, ... })` targeting the mobile app's Expo web dev URL (`$REPLIT_EXPO_DEV_DOMAIN`, e.g. `https://<id>.expo.picard.replit.dev`) signs in "successfully" per the tool, but the app itself never reflects a signed-in state — auth-gated CTAs (e.g. "Se connecter pour réserver") keep showing instead of the authenticated flow, and booking/reschedule/cancel steps can't be reached.

**Cause:** Expo apps bypass the shared reverse proxy and are served on their own dedicated subdomain (see pnpm-workspace skill). The test tool's Clerk session injection is scoped to the main workspace preview domain, so the injected session/cookie doesn't carry over to the separate Expo dev host — this is an architectural gap between the testing infra and Expo's dev-server routing, not an app bug.

**How to apply:** for mobile e2e work gated behind Clerk auth, don't burn cycles retrying `[Clerk Auth]` steps against the raw Expo domain. Instead:
- Verify public/unauthenticated UI (browsing, dropdowns, forms up to the auth gate) via `runTest` against the Expo domain directly.
- Verify auth-gated server logic (reschedule rules, cancel rules, status transitions, overlap checks) via `vitest` integration tests in `artifacts/api-server/test/` (these already fake Clerk headers and don't depend on the browser/domain).
- Treat that combination (unit/integration tests for the gated logic + runTest for the public UI) as sufficient e2e coverage for mobile features that require sign-in, rather than treating "unable" from `runTest` as a real regression.
- Also note: `runTest` has no automatic base-URL resolution for the mobile artifact — it defaults to the shared-proxy/vitrine root unless you read `$REPLIT_EXPO_DEV_DOMAIN` yourself and pass the full `https://<domain>/<path>` literally in `[Browser] Navigate to "..."` steps (Expo Router paths also drop the `(group)` segment, e.g. `/sign-up` not `/(auth)/sign-up`). And first-time visitors hit the onboarding carousel at `/`, which can block a `[Clerk Auth]` step even with a "tap skip first" instruction — for role-gated UI behind that carousel (e.g. hiding a button for barbers), prefer typecheck + code review over repeated `runTest` attempts once 1-2 tries hit this friction.
