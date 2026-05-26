---
name: Barber approval gate
description: The (barber) layout gates on barberProfile.status (from AppContext), NOT user.status. Confusion between the two caused a silent bug.
---

# Barber Approval Gate

## Rule
Use `barberProfile.status !== "approved"` to redirect pending barbers to the `/pending` screen, not `user.status !== "active"`.

**Why:** User account status (`active`/`suspended`/`pending`) is set at signup and is almost always `active` immediately. Barber profile status (`pending`/`approved`/`rejected`/`suspended`) is what the admin approves. Using `user.status` means the pending screen is never shown to barbers awaiting approval.

**How to apply:**
- `AppContext` stores `barberProfile: SyncedBarber | null` populated from the `barber` field of the `/auth/sync` response.
- `(barber)/_layout.tsx` checks: `if (role === "barber" && barberProfile && barberProfile.status !== "approved") return <Redirect href="/(barber)/pending" />`.
- The guard is conditional on `barberProfile` being non-null so that barbers who have NO salon yet (0 salons) are NOT redirected to pending (they see the "create your first salon" empty state in the dashboard instead).
