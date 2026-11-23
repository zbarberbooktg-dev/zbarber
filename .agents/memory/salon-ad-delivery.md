---
name: Salon ad delivery
description: Visibility and OTA rules for salon video ads.
---

Serve ad videos through a dedicated route that checks both the ad status and the salon's approval on every new media request. Keep video storage separate from regular uploads.

**Why:** A direct media link must stop working when an ad is disabled or its salon is no longer public. Public asset URLs and generic upload cleanup don't enforce the same rules.

**How to apply:** Preserve byte-range support without shared caching. When adding or changing native playback dependencies, use a new Expo runtime and build both profiles before publishing OTA updates for that runtime.

Autoplay must stay muted and only one visible ad should play. Preserve a viewer’s pause choice when they scroll away and come back.

**Why:** the user asked for automatic playback, but scrolling or leaving home must not start background playback or override an explicit pause.

Replacing or deleting a video should detach it before removing the old file, with a durable retry if storage is unavailable. Version public and admin video URLs on replacement.

**Why:** deleting the file first can leave a published ad pointing at a missing file; stable video URLs can mix byte ranges from two versions during playback.
