---
name: Account deletion
description: How account deletion works (authed mobile + public vitrine form). Anonymization-on-delete preserves reservation/review integrity.
---

- Authenticated deletion: `DELETE /api/auth/me` anonymizes the `users` row (name="Compte supprimé", email=`deleted-<id>-<ts>@deleted.local`, clerkUserId=null, status="suspended", PII nulled) and deletes the underlying Clerk user. Barber profile cascades.
- **Why anonymize, not hard-delete:** `reservationsTable.clientId` and `reviewsTable.clientId` reference `usersTable.id` **without** `onDelete: cascade`, so a hard delete would either FK-fail or destroy booking/review history needed by other barbers/clients. Anonymization keeps referential integrity and satisfies "right to be forgotten" by stripping PII.
- Public deletion request (vitrine, no auth): `POST /api/account-deletion-requests` stores into `accountDeletionRequestsTable` (status enum: pending/processed/rejected) for manual processing. Best-effort links by email but does not authenticate.
- **How to apply:** any new FK to `usersTable.id` should either set `onDelete: cascade` (only if the data is purely personal and safe to lose) or be re-checked against the anonymization path. Never switch the delete route to hard-delete without auditing every user-referencing FK.
