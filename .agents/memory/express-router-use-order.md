---
name: Express router.use middleware order
description: Router-level middleware on one sub-router can silently block later sub-routers.
---

In `artifacts/api-server/src/routes/index.ts`, sub-routers are mounted with `router.use(subRouter)` (no path prefix). Express runs every request through each sub-router in registration order. A sub-router that calls `router.use(requireAuth, …)` at top level applies that middleware to every request reaching it — including requests that don't match any of its own paths. The middleware will reject (e.g. 401) before Express advances to the next sub-router.

**Why:** A public `GET /home-gallery` mounted AFTER `adminRouter` (which does `router.use(requireAuth, requireAdmin)`) returned 401, even though home-gallery itself has no auth. Symptom: only some public endpoints work; ones registered after a gated router are blocked.

**How to apply:**
- Mount fully-public routers BEFORE any router that calls `router.use(requireAuth …)` at the top level.
- Or, scope the gating middleware to specific paths inside the gated router (e.g. attach `requireAuth` per-route or via `router.use('/admin', …)`).
- When adding a new public endpoint, check `grep -n "router.use(require" artifacts/api-server/src/routes/*.ts` and put the new router before any matches in `routes/index.ts`.
