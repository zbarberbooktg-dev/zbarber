---
name: API resilience to invalid Clerk tokens
description: Why the API must never 500 on a bad Bearer token, and the pattern that keeps public routes serving.
---

# API must degrade a bad token to "unauthenticated", never 500

The mobile `useAuthedFetch` attaches the Clerk token to **every** request, including
public routes (e.g. `GET /api/barbers`, called by the map / "Salons à proximité").
So a stale/mismatched/unverifiable device token reaches even unauthenticated
endpoints.

`clerkMiddleware` from `@clerk/express` is mounted globally and **throws (next(err))**
on a malformed/unverifiable token. With no terminal Express error handler, that
became the default **HTML 500 "Internal Server Error"** page — surfaced verbatim in
the mobile "Erreur" dialog. Public browsing broke purely because a token was bad.

**Why:** verification failure is a client-auth condition, not a server fault. A bad
token must mean "signed out", not "server down". Test env makes this common (Clerk
key/proxy mismatch between prod-issued tokens and the backend).

**How to apply (the pattern, all in `app.ts` + `clerkAuth.ts`):**
1. Wrap the global clerk middleware so its `next(err)` is logged and swallowed →
   continue as unauthenticated. Public routes still serve.
2. `requireAuth` wraps `getAuth(req)` in try/catch → a throw becomes `401`, not `500`.
   Protected routes stay protected (no userId → 401), so this is NOT an auth bypass.
3. Add a terminal 4-arg Express error handler that returns JSON `{error}` (never HTML),
   so any future unhandled error stays parseable by clients.
4. `attachOptionalUser` (storage.ts) already try/catches getAuth — keep that shape for
   any new optional-auth middleware.

Regression test: `test/apiResilience.test.ts` mocks `@clerk/express` so the middleware
errors and `getAuth` throws, then asserts public `/barbers` = 200 JSON and protected
`/barbers/me` = clean 401 JSON.

Related UX rule — gate auth UI on Clerk `isSignedIn`, NOT on the locally-synced
`user`. When the token can't be verified, `/auth/sync` fails and `user` stays null
while `isSignedIn` is true. Home once gated its login/register CTAs on
`isSignedIn && user`, so a signed-in-but-unsynced user still saw "Connexion /
Inscription"; tapping them hit auth screens that redirect on `isSignedIn` alone →
visible loop. Gate CTAs and screen guards on the SAME signal (`isSignedIn`); only
personalized content (e.g. "Bonjour {name}") may additionally require `user`, with a
generic fallback (never deref `user` in the signed-in branch).

Also: after a password reset the user is auto-signed-in, so the auth screens'
`isSignedIn` guard redirects them home — intended, not a bug.
