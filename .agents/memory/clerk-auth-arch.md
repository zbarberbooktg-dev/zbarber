---
name: Clerk auth architecture
description: How Clerk JIT provisioning works across API/mobile/admin; which routes use generated hooks vs raw fetch.
---

# Clerk Auth Architecture

## Rule
Clerk JWT is verified via the `@clerk/express` proxy middleware in the API. Local user records are provisioned JIT via `POST /auth/sync` (called from mobile AppContext on sign-in and from admin after sign-in). There are no session cookies.

**Why:** Clerk handles identity/MFA/OAuth; the local DB holds role, barber profile, and business data. Syncing on each login ensures the local record stays aligned.

**How to apply:**
- Mobile: `AppContext.syncAuth()` calls `/auth/sync` and stores `{ user, barber }` response.
- API guards: `requireAuth` (any signed-in), `requireAdmin`, `requireApprovedBarber` in `artifacts/api-server/src/lib/clerkAuth.ts`.
- Admin: wraps in `<ClerkProvider>`, hits `/auth/sync` post sign-in, blocks non-admin with "access denied" screen.
- Barber self-service routes (`/barbers/me`, `/barbers/me/revenue`, `/barbers/me/clients`, `/barbers/me/schedule`) use `useAuthedFetch` directly in mobile (NOT generated hooks from Orval), because the mobile barber screens predate/bypass codegen for these endpoints.
- `getToken` from `@clerk/expo` is unstable (new identity each render) — never add to `useEffect` deps; capture via closure.
