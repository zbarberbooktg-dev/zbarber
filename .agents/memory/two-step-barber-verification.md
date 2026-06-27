---
name: Two-step barber verification
description: Durable design decisions for the two-stage barber approval (first-validate → document upload → final approve).
---

# Two-step barber verification

Barber accounts go through two admin validations, not one: `pending` → first-validate → `awaiting_document` (barber uploads an official authorization document within ~30 days) → final approve → `approved`. Admin can also reject a submitted document, keeping the account in `awaiting_document`.

**Key decisions (the non-obvious parts):**

- **Role flips at FIRST validation, not final.** First-validate promotes the user client→barber so they can reach the upload surface; full barber features stay gated until `approved`. (Earlier single-step model flipped role only at approve.)
- **The 30-day deadline is soft, never a hard lock.** The upload endpoint must keep accepting (re)submissions while status is `awaiting_document`, even past the deadline. **Why:** the spec keeps the account `awaiting_document` until a *conforming* document is validated; rejecting late uploads creates a permanent dead-end (can't submit, can't approve without a document, can't re-run first-validate since status ≠ pending). The deadline only drives reminders/UI emphasis.
- **Enforce the transitions server-side, not just in the UI.** first-validate only from `pending`; approve only from `awaiting_document` AND with a submitted document; document/reject only from `awaiting_document` with a submitted document. Invalid transitions return 409. **Why:** a stale/rogue admin client could otherwise single-step approve straight from `pending`, bypassing document review.
- **Upload must be reachable from the barber profile during the window, not only a standalone pending screen.** `awaiting_document` barbers keep the Profile tab (with the upload card) while all other feature tabs are hidden; the dashboard redirects them to Profile. **Why:** explicit acceptance criterion — the upload has to live in the profile, not be buried behind a redirect-only screen.

**Mechanics worth knowing (not code-derivable):**

- `/auth/sync` and `/auth/me` return the **full barber row**, so any new barber column reaches mobile automatically — widen the mobile `SyncedBarber` type and consume it; no per-field server mapping needed.
- The document is a **private** storage object; admins view it because the optional-user middleware also attaches an admin identity from the admin cookie JWT, and the storage ACL allows admin.
