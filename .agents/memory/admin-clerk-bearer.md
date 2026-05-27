---
name: Admin web — Clerk Bearer token required
description: Why browser SPAs on Replit's shared proxy must send Clerk JWTs via Authorization header, not rely on the session cookie.
---

Browser SPAs running on Replit's shared-proxy setup must authenticate API calls with `Authorization: Bearer <clerk-jwt>`, NOT by relying on Clerk's session cookie.

**Why:** Clerk dev instances scope their session cookie to the Clerk frontend-API host, not to the picard.replit.dev shared-proxy host the SPA + API share. So same-origin `fetch` carries no Clerk credentials and the API's `clerkMiddleware` returns 401 on every call. Symptom is "sign in succeeds, then immediately bounced back to /sign-in" because any 401 from `/auth/sync` triggers the auto-signout fallback in the auth gate.

**How to apply:** in any browser-SPA artifact talking to the api-server, mirror mobile's pattern:
1. Inside Clerk's provider tree, register the token getter once with the generated API client (clear on unmount).
2. Pass the token explicitly into hand-rolled bootstrap fetchers (`/auth/sync`). Orval-generated hooks pick it up automatically via the registered getter.

The generated-client warning that says bearer auth is for native only is wrong for this proxy topology — cookies do not flow reliably across Replit's shared proxy in dev.
