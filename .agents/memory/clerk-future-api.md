---
name: Clerk @clerk/expo 3.x Future API
description: Mobile uses Clerk's "future" SignIn/SignUp API (the only one exposed by useSignIn/useSignUp). It is shape-incompatible with the classic Clerk docs — methods are namespaced and async returns {error} instead of throwing.
---

# Clerk Future API on mobile (@clerk/expo 3.x)

`useSignIn()` returns `{ signIn, errors, fetchStatus }` — **no `isLoaded`, no `setActive`**.
`signIn` is a `SignInFutureResource`, not the classic `SignInResource`. Most classic methods (`create`, `attemptFirstFactor`, `prepareFirstFactor`, …) are either absent or have a different signature.

**Why:** Clerk shipped a new "future" API; @clerk/expo 3.x's `useSignIn` hook exposes only it. The classic types you find in Clerk's web docs will fail TS with "Property X does not exist on type 'SignInFutureResource'" or "'reset_password_email_code' is not assignable to OAuthStrategy | ...".

**How to apply:** When writing any new mobile auth flow, check `SignInFutureResource` in `@clerk/shared/dist/types/index.d.ts` (search for `interface SignInFutureResource`). Mirror the patterns already in `artifacts/mobile/app/(auth)/sign-in.tsx`. Key shape:

- `signIn.create({ identifier })` — start an attempt; returns `{ error }`.
- `signIn.password({ identifier, password })` — password sign-in (combines create + attempt).
- `signIn.emailCode.{sendCode,verifyCode}` — email-code sign-in.
- `signIn.resetPasswordEmailCode.{sendCode,verifyCode,submitPassword}` — full reset flow.
- `signIn.mfa.{sendPhoneCode,sendEmailCode,verifyPhoneCode,verifyEmailCode,verifyTOTP,verifyBackupCode}` — MFA second factor.
- `signIn.finalize({ navigate })` — activates session (replaces `setActive`). Always called when `signIn.status === "complete"`.
- All methods return `{ error: ClerkError | null }` — branch on `error`, don't try/catch alone.
- Disable submit while `fetchStatus === "fetching"` (analog to classic `isLoaded`).

## Forgot-password specifics

Sequence: `create({identifier})` → `resetPasswordEmailCode.sendCode()` → `verifyCode({code})` (status → `needs_new_password`) → `submitPassword({password})` (status → `complete` or `needs_second_factor`) → `finalize({navigate})`.

## Enumeration safety (reset / passwordless flows)

Reset-request and resend endpoints **must not** surface Clerk errors to the UI — different error messages for "user exists" vs "user not found" enable account enumeration. Always show a neutral "Si un compte existe, un code a été envoyé" and advance to the code-entry step regardless of the backend outcome. Log details with `console.warn` only. Detailed errors are fine **after** the user has proven possession of the emailed code (verifyCode / submitPassword).
