---
name: Push notifications & lifecycle pushes
description: Expo push infrastructure, sendPush helper, and the re-engagement / thank-you claim-then-send markers.
---

## Architecture
- Device tokens live in `deviceTokensTable` (token globally UNIQUE; upsert on conflict re-points userId so a re-used device never pushes to the previous account).
- Server helper `sendPush(userId, title, body, data)` (api-server `lib/push.ts`) is fully fire-and-forget: never throws, fans out to all of a user's tokens, and prunes tokens Expo reports as `DeviceNotRegistered`. Uses `expo-server-sdk`; `EXPO_ACCESS_TOKEN` is optional.
- Mobile registers the Expo token after `/auth/sync` succeeds (AppContext `ensurePushRegistered`) and unregisters on sign-out. Push only works on real devices / dev builds, not Expo Go SDK53+ or web — `getExpoPushToken` returns null there.

## Re-engagement push (3-week idle)
- **Rule:** eligibility = the user's MAX(reservation.createdAt) is older than `REENGAGE_AFTER_DAYS` AND `users.lastReengagementAt IS NULL`. The sweep atomically stamps `lastReengagementAt` (claim-then-send) then pushes.
- **Why:** the marker must be RESET to NULL on every new booking (done in `POST /reservations`) so a returning client re-arms and can be re-engaged after their NEXT quiet stretch — otherwise they'd only ever get one re-engagement push for life.

## Thank-you email (on completed)
- Triggered inline when a reservation transitions to `completed` (reservations route → `sendThankYouEmail`), NOT only via a sweep. Claim-then-send via `reservations.thankYouSentAt` so re-applying "completed" or a race can't double-send.
