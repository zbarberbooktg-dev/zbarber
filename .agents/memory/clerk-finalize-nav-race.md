---
name: Clerk finalize() navigation race
description: Why auth screens must NOT pass an imperative router.replace navigate to Clerk finalize when an isSignedIn <Redirect> guard exists on the same screen
---

# Clerk `finalize({ navigate })` races the `isSignedIn` redirect guard

On mobile (`@clerk/expo` Future API), an auth screen that both:
1. has a guard `if (isSignedIn) return <Redirect href="/" />;`, and
2. calls `signIn.finalize({ navigate: () => router.replace("/") })` on success

fires **two** navigations to the same target: the imperative `router.replace("/")` from
the finalize callback, and a second `REPLACE` from the `<Redirect>` that mounts the instant
Clerk flips `isSignedIn`. They collide while the `(auth)` stack is unmounting, so one lands
on a stale navigator and React Navigation throws (dev LogBox):
`The action 'REPLACE' with payload {name:index} was not handled by any navigator. Do you have a route named 'index'?`

**Rule:** pick ONE navigation source. When an `isSignedIn` `<Redirect>` guard is present,
make finalize's navigate a no-op (`navigate: () => {}`) and let the guard navigate.

**Why:** the guard is required anyway (handles a signed-in user opening the auth screen
directly), so the imperative replace is pure redundancy that only adds a race.

**How to apply:** applies to every `signIn.finalize`/`signUp.finalize` on a screen that
also renders an `isSignedIn` redirect. Exception: `sign-up.tsx` keeps its imperative
`router.replace` because its guard is suppressed during the `verify` step
(`isSignedIn && step !== "verify"`) while avatar-upload + `syncAuth` run — so it has no
double-dispatch and needs the explicit navigate.

**Amplifier (not the trigger):** `/` is ambiguous in this app — `app/index.tsx`,
`app/(client)/index.tsx`, and `app/(barber)/index.tsx` all resolve to `/`, which makes
REPLACE-to-`/` resolution fragile. Removing the race fixes the crash; the ambiguity remains
a latent structural risk (a future hardening would redirect guards to role-aware
`/(client)` or `/(barber)` instead of raw `/`).
