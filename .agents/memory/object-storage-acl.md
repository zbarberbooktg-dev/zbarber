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

## Reference-based ACL must be backed by upload-ownership binding

The "private = whoever's row references the path" model is forgeable on its own: an attacker who learns a victim's `/objects/<uuid>` path can write it into their OWN record (financing idDocument/guarantorIdDocument, or `barbers.documentUrl`) and thereby become an authorized `privateOwner` who can read the victim's PII.

Fix: `objectUploadsTable` (object_path PK → userId) is written at `POST /storage/uploads/request-url`, binding every issued path to its uploader. EVERY write that can grant private-object ownership must verify the submitted path has a binding owned by the submitter — strict, no reference-based fallback. Currently enforced in `POST /financing-requests` and `POST /barbers/me/document`.

**Why:** financing requests carry scanned national IDs/passports of barber + guarantor; multiple code-review rounds flagged path-claiming (incl. pre-reference/concurrency and cross-route via documentUrl) as the residual leak after classification was fixed.

**How to apply:** Any NEW route that accepts a client-supplied `/objects/...` path which then becomes private (or feeds privateOwners) MUST check `objectUploadsTable.userId === req.localUser.id` and reject otherwise. Legitimate flows always upload fresh files at submit time, so they always have a binding; legacy unbound paths are correctly rejected. Also: the storage ACL owner check must evaluate ALL barbers owned by the user (no `.limit(1)`) since one user can own multiple salons.
