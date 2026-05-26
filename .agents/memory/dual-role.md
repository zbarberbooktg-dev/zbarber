---
name: Dual-role accounts
description: How a single Clerk user can hold both "client" and "barber" capabilities; only one is "active" at a time, switching is opt-in.
---

- Clerk = one account per email; we cannot have a separate client + barber account on the same email. To satisfy "same person, both roles", `users.role` is the **currently active** role and we treat the presence of a barber profile (`barbersTable.userId = user.id`) as the user's barber capability.
- `POST /api/auth/active-role { role: "client" | "barber" }` flips the active role. Required guards: admins can't switch; switching to "barber" is rejected unless the user already has ≥1 row in `barbersTable`.
- `POST /api/auth/sync` also enforces the same eligibility on role changes, with one exception: a "fresh" client account (no phone, no city, no barber rows yet) may transition to "barber" — this is the signup path, since the profile is created in the next request via `POST /barbers/me`.
- Mobile UX: client→barber button checks `/barbers/me`; if non-empty, calls active-role + `syncAuth()` + navigate. If empty, opens CreateSalonModal, then on success calls active-role. Barber→client always allowed.
- **Why:** stops a logged-in client from quietly POSTing `/auth/sync { role: "barber" }` to escalate into the barber surface without ever creating a salon.
- **How to apply:** any new route or admin action that changes `users.role` must call the same eligibility check (existing barber profile OR the fresh-signup exception). Never trust client-supplied `role` directly.
