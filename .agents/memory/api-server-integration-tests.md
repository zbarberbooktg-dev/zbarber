---
name: api-server integration tests
description: How to write vitest+supertest integration tests against the Express API given its dual auth model.
---

# api-server integration tests

The api-server now has vitest integration tests (`artifacts/api-server/test/*.test.ts`, run via `pnpm --filter @workspace/api-server run test`). They hit the **real dev Postgres** (DATABASE_URL) and seed/clean their own rows with `randomUUID()` identifiers.

**Auth is dual, so each scheme is faked differently — this is the non-obvious part:**
- **Clerk users (clients/barbers):** `vi.mock("@clerk/express")` so `getAuth` returns a `userId` read from a request header (`x-test-clerk-user`). Pre-seed the user row with that `clerkUserId` so `provisionUserFromClerk` finds it and never calls `clerkClient.users.getUser`.
- **Admins (self-managed):** no mock — sign a real cookie JWT with `signAdminToken(adminId)` and send it as the `gbc_admin` cookie. Requires an `active` row in `adminAccountsTable`.

**Other required fakes:** `vi.mock` `../src/lib/objectStorage` (return a 200-ish `downloadObject` so ACL outcome, not bytes, is asserted), `../src/lib/email`, `../src/lib/push`. Build a tiny test app that mounts the routers and injects a no-op `req.log` (handlers call `req.log.error` without optional chaining).

**Gotchas:**
- Don't import `app.ts` — it pulls clerk proxy middleware + `ensureRootAdmin` side effects. Mount the needed routers directly.
- `tsconfig.json` only includes `src`, so the `test/` dir is checked by vitest, not `tsc`.
- If a seed insert fails with `column ... does not exist`, the dev DB is stale — run `pnpm --filter @workspace/db run push` (this happened: `document_reminder_stage` was missing).
