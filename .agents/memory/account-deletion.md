---
name: Account deletion
description: How account deletion works (authed mobile + public vitrine form). Anonymization-on-delete preserves reservation/review integrity.
---

- Authenticated deletion: `DELETE /api/auth/me` anonymizes the `users` row (name="Compte supprimé", email=`deleted-<id>-<ts>@deleted.local`, clerkUserId=null, status="suspended", PII nulled) and deletes the underlying Clerk user. Barber profile cascades.
- **Why anonymize, not hard-delete:** `reservationsTable.clientId` and `reviewsTable.clientId` reference `usersTable.id` **without** `onDelete: cascade`, so a hard delete would either FK-fail or destroy booking/review history needed by other barbers/clients. Anonymization keeps referential integrity and satisfies "right to be forgotten" by stripping PII.
- Public deletion request (vitrine, no auth): `POST /api/account-deletion-requests` stores into `accountDeletionRequestsTable` (status enum: pending/processed/rejected) for manual processing. Best-effort links by email but does not authenticate.
- **How to apply:** any new FK to `usersTable.id` should either set `onDelete: cascade` (only if the data is purely personal and safe to lose) or be re-checked against the anonymization path. Never switch the delete route to hard-delete without auditing every user-referencing FK.
- **Admin-initiated deletion shares the same anonymize path.** A single shared helper is the only sanctioned delete: it anonymizes the user row AND suspends+scrubs every salon that user owns (one DB transaction), then best-effort deletes the Clerk user. Both `DELETE /users/:id` and `DELETE /barbers/:id` (admin) use it; the old `DELETE /users/:id` hard-delete was a latent FK-failure bug.
- **Product decision — barber delete = whole-account delete.** Deleting from a single salon row in admin removes the owner's **entire account and ALL their salons** (barber→owner userId→anonymize). This is intentional ("delete account" semantics, no orphaned public salons); the admin confirm copy must say "all salons of this account". If per-salon deletion is ever wanted, it needs a separate route that deletes one `barbersTable` row only.
