---
name: Availability & slot generation
description: How barber availability slots are computed dynamically from weekly hours, service duration, bookings, and days_off.
---

Public endpoint `GET /api/barbers/:id/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=X` is the single source of truth for bookable slots. Clients (mobile salon detail) and the barber-side `(barber)/slots.tsx` screen both consume it. **Never re-generate slots client-side.**

Generation rules:
- Step size = `servicesTable.durationMinutes` for the given `serviceId`, else 30 min default.
- For each date in the range, look up the weekly schedule by lowercased day key (`sun|mon|tue|wed|thu|fri|sat` — mapped from JS `Date.getDay()`). `isWorking=false` → empty slots, day skipped.
- A row in `daysOffTable` for `(barberId, date)` marks the day as `isBlocked=true` → empty slots.
- Slots that overlap `breakStart..breakEnd` are skipped.
- Slots are marked `available:false` with `reason: "past"` when in the past, `reason: "booked"` when a reservation with status `pending|confirmed` exists at the same ISO timestamp.

**Why:** Hardcoded slots in the client (the previous behaviour) ignored barber hours, service duration, breaks, and double-booked. Centralising the computation server-side keeps client UI dumb and bookings consistent.

**How to apply:**
- Any new surface that needs to show slots must hit `/availability`, never recompute.
- `daysOffTable` (re-used from existing schema, exported via `lib/db/src/schema/index.ts`) is the only day-blocking primitive — no separate "overrides" table; slot-level overrides not yet supported.
- Barber writes: `GET/POST /barbers/me/days-off` and `DELETE /barbers/me/days-off/:id` (scoped by `barberId AND id` to prevent IDOR).
- React Query keys: `["availability", barberId, serviceId, from, to]` (client) and `["myAvailability", barberId, from, to]` + `["myDaysOff", barberId]` (barber). Invalidate both when toggling a day off.
