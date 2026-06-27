---
name: Account role model (client default + admin-validated barber)
description: Roles are not a manual toggle. Every account is a client; becoming a barber is an admin-validated request, never self-promotion.
---

- One Clerk account per email. `users.role` is the account's capability level: `"client"` (default for everyone) or `"barber"` (client + barber capabilities). Admins are separate (`adminAccountsTable`, see admin-auth-split).
- A barber account can browse and book exactly like a client. The mobile `(client)` tab group allows both `client` and `barber` (only `admin` is redirected away); `POST /reservations` allows any non-admin to book.
- **Becoming a barber is an admin-validated REQUEST, not self-service.** The ONLY place `users.role` flips client→barber is the admin approve endpoint (`PATCH /barbers/:id/approve`), guarded `eq(role,"client")`. There is no self-promotion path.
- Removed self-promotion paths (do not reintroduce): `POST /auth/active-role` (deleted), role flip on salon creation in `POST /barbers/me`, role promotion in `POST /auth/sync`, and `metaRole==="barber"` in `provisionUserFromClerk`. `/auth/sync` still accepts `role` in its body for old clients but ignores it.
- `/auth/me` and `/auth/sync` return the barber profile whenever one exists (even `status:"pending"`), regardless of `users.role`, so the client can surface a pending request. AppContext exposes `barberProfile`; `barberProfile.status === "pending"` = request awaiting validation.
- Mobile UX: client profile shows a "become a barber" button that opens CreateSalonModal (or a disabled "request pending" state if a pending profile exists); `onCreated` only syncs + shows a "request sent" alert (no role activation). Auto-opens via `?becomeBarber=1` param (sign-up routes barber-choosers there). No more client↔barber switch buttons on either profile screen.
- **Why:** stops a logged-in client from escalating into the barber surface (via active-role, sync, or salon creation) without admin approval. Barber capability must be gated behind a human validation step.
- **How to apply:** any new route/action that sets `users.role = "barber"` must be admin-only. Never trust client-supplied `role`. Treat presence of a pending `barbersTable` row as "request submitted", not "is a barber".
