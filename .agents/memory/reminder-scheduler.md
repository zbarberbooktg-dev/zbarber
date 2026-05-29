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
