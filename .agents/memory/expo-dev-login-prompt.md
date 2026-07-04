---
name: Expo dev server hangs on Replit (login prompt) — use EXPO_OFFLINE=1
description: Why the mobile Expo workflow shows a blank QR/nothing on phone, and the offline-mode fix.
---

**Symptom:** the `artifacts/mobile` Expo workflow never serves a usable QR; scanning shows nothing on the phone. Logs loop on `It is recommended to log in with your Expo account before proceeding` (https://expo.fyi/unverified-app-expo-go) with a `Log in / Proceed anonymously` prompt, plus `MaxListenersExceededWarning ... listeners added to [ReadStream]`.

**Cause:** `app.json` sets `owner` + `extra.eas.projectId`, so `expo start` makes an account/network call and shows an *interactive* prompt. A Replit workflow has no TTY to answer it, so `expo start` blocks forever and never finishes starting the dev server → no working QR.

**Fix:** prefix the mobile `dev` script with `EXPO_OFFLINE=1` (offline mode skips the account call and the prompt). Metro then starts and prints the `exp://…expo.picard.replit.dev` QR normally.
**Why:** offline mode is a targeted bypass; `CI=1` also disables interactivity but changes other CLI behavior. Keep `owner`/`projectId` — they're required for EAS builds; do NOT delete them to silence the prompt.
**Note:** offline mode logs `unable to sign manifest` — this is non-fatal; Expo Go loads unsigned *dev* manifests fine (signing only matters for production/updates).
**How to apply:** any Replit-hosted Expo app that hangs at startup with the login recommendation → add `EXPO_OFFLINE=1` to the dev command, restart the workflow, confirm the QR line appears.
