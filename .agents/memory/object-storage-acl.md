---
name: Object storage ACL model
description: How GET /storage/objects/* decides who can read an object path.
---

Rule: an authenticated-or-not request to `GET /storage/objects/<path>` is granted ONLY if the path is referenced by a known row:
- financing → admin or owning barber
- avatar / logo / barber gallery / home gallery → open read
- anything else (orphan upload) → 404

**Why:** Presigned PUT creates the object before any DB row exists. A "fallback: serve to any authed user if not yet referenced" branch leaks private uploads across users — flagged as broken access control in code review. Mobile/web clients already hold the local URI right after PUT, so they don't need to fetch it back before persistence.

**How to apply:** When adding a new public-display upload category (e.g. menu cover, conference banner), add the table lookup to the non-financing branch in `artifacts/api-server/src/routes/storage.ts`. Do NOT reintroduce a "if (req.localUser) allow" fallback.
