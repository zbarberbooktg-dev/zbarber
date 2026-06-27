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

## Salon independence (each salon is a fully independent entity)
Every `/barbers/me/*` self-service route is now **salon-aware**, NOT primary-salon-only. `getMyBarberOr404` reads an optional `?salonId=` query, verifies the caller owns it (ownership = the salon's `barbersTable.id` belongs to the current user), and only falls back to the first owned salon (ordered by id) when no `salonId` is given. This covers revenue, stats/advanced, clients, schedule, days-off, realisations, panoramas, queue, loyalty. `reservations.ts` and `financing.ts` filter by the selected owned salonId (or all owned ids when none given) and check ownership across ALL owned salons on `/:id` routes. `notificationsTable` has a nullable `barberId`; GET `/notifications` accepts optional owned `salonId` (returns `userId=me AND (barberId=sid OR barberId IS NULL)`).

**Why:** A multi-salon barber must see per-selected-salon data with no cross-salon leak, and every `salonId` param must be authorization-checked.

**How to apply (mobile):**
- Global selected salon lives in `AppContext` as `selectedSalonId` / `setSelectedSalonId` (persisted to AsyncStorage key `gbc.selectedSalon`). The dashboard salon selector sets it.
- Use `withSalon(path, salonId)` from `@/lib/api` to append `?salonId=` to every `/me` fetch, and add `selectedSalonId` to every TanStack `queryKey` so switching salons refetches.
- Screens that fetch `["barbersMe"]` directly (queue, slots) resolve the active salon as `salons.find(s => s.id === selectedSalonId) ?? salons[0]` and pass that id.
- `/barbers/:id/*` path-param routes (availability, services) are already salon-scoped by the path — pass the resolved salon id there too.
