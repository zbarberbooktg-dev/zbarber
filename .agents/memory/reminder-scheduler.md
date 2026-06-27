---
name: Reservation reminder scheduler
description: How the 24h email reminder background job stays idempotent and downtime-resilient.
---

# Reservation reminder scheduler

A `setInterval` sweep in api-server (`lib/reminderScheduler.ts`, started from `index.ts` after `app.listen`) emails clients ~24h before their appointment. `reservationsTable.reminderSentAt` is the dedup marker.

## Rules

- **Claim-then-send, never select-then-send.** The sweep does a single `UPDATE ... SET reminderSentAt = now() WHERE reminderSentAt IS NULL AND status IN (pending,confirmed) AND scheduledAt > now AND scheduledAt <= now+24h RETURNING id`, then only sends emails for the returned ids.
  - **Why:** overlapping sweeps, restart races, or multiple API instances would otherwise both read the same unsent row and double-email the client. The atomic update claims rows so each is sent at most once.
  - **Trade-off:** a row is marked sent before the email is dispatched, so a failed send is NOT retried (logged only). Preventing duplicates was chosen over guaranteeing delivery.

- **Window is an upper bound, not a narrow band.** Use `scheduledAt > now AND scheduledAt <= now+24h`, not `[now+23h, now+24h]`.
  - **Why:** a narrow band permanently misses reservations if the scheduler is down during that hour. The upper-bound form catches up any still-future unreminded reservation on the next sweep.

- Rows with no client email are still claimed (marked sent) so they aren't rescanned forever.

## Barber document-deadline reminders (multi-stage claim)

- Same sweep file also nudges `awaiting_document` barbers before their 30-day upload deadline. Marker is `barbersTable.documentReminderStage` (int: 0=none, 1=7d band, 2=1d band) — a *staged* claim, not a boolean.
- **Stage windows must be NON-overlapping**, or a barber first seen with ≤1d left is claimed by both stages in one sweep → two emails/pushes back-to-back. Stage 1 band = (now+1d, now+7d]; stage 2 band = (now, now+1d].
  - **Why staged not boolean:** two distinct nudges (7d, 1d) must each fire once; `< stage` lets the 1-day stage still claim a row even after the 7-day stage stamped it.
  - **Edge case:** if the 7d window is entirely missed (downtime days 23–29) the barber simply gets the 1-day reminder once — never both, never zero.
- `documentUrl IS NULL` in the predicate auto-stops reminders the moment a barber submits — no extra marker reset needed. Deadline is soft (memory: two-step-barber-verification), so reminders intentionally do NOT auto-expire/reject overdue barbers.
- Runs hourly (not the 15-min reservation cadence) — deadline reminders are day-granular.
