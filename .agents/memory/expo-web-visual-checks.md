---
name: Expo web visual verification
description: Avoid false positives from mounted background screens and the animated launch overlay.
---

For browser checks, target a visible screen-specific control rather than the
first matching text. Before saving a home screenshot, wait for the launch
overlay to finish, not merely for the search field to mount.

**Why:** React Navigation retains earlier screens in the DOM, so a shared title
can resolve to a hidden previous screen. The launch animation also covers
already-mounted controls: a locator can pass while the screenshot still shows
only the splash logo.

**How to apply:** use unique visible test IDs for route assertions and allow
the existing launch animation to complete. Do not alter production navigation,
auth, or splash behavior just to make browser tests pass. Label web screenshots
as size previews, not native device validation.
