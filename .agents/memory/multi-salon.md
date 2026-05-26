---
name: Multi-salon barber model
description: GET /barbers/me returns an array; barbers can own multiple salons; all consumers must handle the array shape.
---

# Multi-Salon Barber Model

## Rule
`GET /barbers/me` returns `Barber[]` (array), not a single object. There is no unique constraint on `barbersTable.userId` at the DB level. `POST /barbers/me` creates a new salon without checking for an existing one.

**Why:** The product allows a barber to manage multiple salons (e.g., franchises). DB constraint was intentionally omitted.

**How to apply:**
- All mobile consumers of `["barbersMe"]` query must type the result as `MyBarber[]`.
- To get the "primary" salon, always extract `data[0]`.
- `(barber)/index.tsx` has a multi-salon selector (`selectedIdx` state) when `salons.length > 1`.
- Revenue/clients/schedule queries currently use the first/only salon server-side (`getMyBarberOr404` picks first). Adding `salonId` query param scoping is the next step for full multi-salon support.
- `PATCH /barbers/me` also operates on the first salon; needs `salonId` param for true multi-salon.
