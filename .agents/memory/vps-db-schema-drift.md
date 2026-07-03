---
name: VPS DB schema drift (deploy runs no migrations)
description: Why a single table's routes 500 on the deployed test/prod env while others work, and how to fix it.
---

# VPS DB schema drift

**Rule:** The VPS deploy pipeline does NOT migrate the database. `deploy-test.yml`
(and the prod equivalents) only `git fetch` + `git reset --hard origin/<branch>`
then run `deploy/deploy.sh <service> <env>`, which rebuilds/restarts services.
Neither script runs `drizzle-kit push` / any migration. Schema changes reach a
VPS DB **only** when someone manually runs `pnpm --filter @workspace/db run push`
against that env's `DATABASE_URL` (on the VPS, where `api-<env>.env` holds it).

**Consequence:** Any column/table added to `lib/db/src/schema/*` that hasn't been
push'd to the VPS test/prod DB makes every `db.select().from(<thatTable>)` throw
`column ... does not exist` → the route returns 500 (`{"error":"Internal Server
Error"}` once the JSON error handler is in place, HTML 500 before it). Pushing new
CODE to `test` will NOT fix it — code deploy and DB schema are decoupled.

**Why:** deploy scripts were written to be fast/idempotent over a shared checkout
and intentionally never touched the DB; migrations were assumed to be run by hand.

**How to diagnose (no VPS DB access needed):** probe several *public* GET
endpoints that hit *different* tables (e.g. `/api/countries`, `/api/articles`,
`/api/reviews`, `/api/subscription-plans`, `/api/home-gallery` vs `/api/barbers`).
If only ONE table's routes 500 while all others return 200, it's schema drift on
that table — not a code bug and not an auth/token bug. `/api/healthz` (no DB)
staying 200 confirms the server itself is healthy.

**How it's fixed now (implemented):** `deploy/deploy.sh` (the `api` branch) auto-runs
the schema sync on every api deploy — it reads `DATABASE_URL` from
`/etc/zbarber/api-<env>.env` and runs `pnpm --filter @workspace/db run push`
**before** rebuilding/restarting, so schema goes live with the code. This covers
BOTH envs because `deploy-test.yml` (auto) and `deploy-api-prod.yml` (manual
dispatch) both call `deploy.sh api <env>` — no `.github/workflows/*` edit needed,
so no `workflow`-scope PAT required. The push is non-interactive and does NOT use
`--force`: stdin is `/dev/null`, so additive changes apply but a destructive/
ambiguous diff aborts the deploy (red) instead of dropping data — resolve those by
running the push by hand (SSH to VPS, load `api-<env>.env`, run the push).

**Recently-added `barbersTable` columns most likely to be missing on a stale DB:**
two-step-verification / document fields (`first_validated_at`, `document_url`,
`document_submitted_at`, `document_deadline`, `document_review_note`,
`document_reminder_stage`).
