---
name: Calendar + digital clock time picker
description: Booking/reschedule slot picker uses a month calendar + HH:MM time grid, not a flat dropdown list.
---

Mobile booking (`salon/[id].tsx`) and reschedule (`RescheduleModal.tsx`) both pick a slot via `DateTimePicker` (components/DateTimePicker.tsx): a bottom-sheet with a Monday-first month calendar (prev/next month nav, bounded by the fetched availability range) and, below it, a grid of HH:MM time chips for the day tapped. Both consumers pass the raw `availability` day array (not a flattened slot list) plus `locale`.

**Why:** the old `SlotPicker` flat list only worked well for a short (~2 week) window; once the availability fetch window was widened to ~8 weeks (56 days) so clients could plan further ahead, a flat list became unusable and was replaced entirely (component deleted).

**How to apply:** any new flow that needs a slot picker should reuse `DateTimePicker`, not resurrect a flat list, and should fetch availability with a multi-week `from`/`to` range (see the `+55 days` pattern in both consumers) rather than ~2 weeks.
