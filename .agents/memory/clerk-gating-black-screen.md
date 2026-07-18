---
name: Mobile Clerk-gating black screen
description: Wrapping root layout in ClerkLoaded (or gating ThemedRoot/home on isLoaded) causes a permanent black screen when the Clerk proxy is slow or misconfigured.
---

## The rule

- `AppContext.ready` must equal `storageReady` only — not `isLoaded && initialSyncDone`.
- `index.tsx` (public home) must NOT include `!isLoaded` in its null-return guard.
- `(client)/_layout` and `(barber)/_layout` SHOULD include `!isLoaded` so protected routes still wait for Clerk before auth decisions.
- Do NOT wrap the root layout tree in `<ClerkLoaded>`.

## Why

When `EXPO_PUBLIC_CLERK_PROXY_URL` is set, Clerk makes a network call to that proxy during init. If the proxy is slow or unreachable, `isLoaded` stays `false` indefinitely. The `AnimatedSplash` (~4s) hides the blank loading state but then disappears — revealing a black/dark screen (`palette.background`) that never resolves.

`ClerkLoaded` as root wrapper compounds this: nothing in the tree renders at all until Clerk responds.

## How to apply

- `AppContext`: `ready: storageReady` — AsyncStorage resolves in <50ms so `ThemedRoot` renders the Stack immediately.
- Public home (`index.tsx`): remove `!isLoaded` from the spinner guard; `isSignedIn=undefined` when not loaded → the `isSignedIn &&` guard naturally skips auth checks.
- Protected group layouts (`(client)`, `(barber)`): add `!isLoaded` to their `return null` check so they don't redirect to sign-in before Clerk confirms the session.
- Never use `<ClerkLoaded>` as a root-level wrapper; it's fine for specific conditional UI pieces.
