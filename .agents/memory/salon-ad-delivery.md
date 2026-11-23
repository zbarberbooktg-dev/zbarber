---
name: Salon ad delivery
description: Visibility and OTA rules for salon video ads.
---

Serve ad videos through a dedicated route that checks both the ad status and the salon's approval on every new media request. Keep video storage separate from regular uploads.

**Why:** A direct media link must stop working when an ad is disabled or its salon is no longer public. Public asset URLs and generic upload cleanup don't enforce the same rules.

**How to apply:** Preserve byte-range support without shared caching. When adding or changing native playback dependencies, use a new Expo runtime and build both profiles before publishing OTA updates for that runtime.
