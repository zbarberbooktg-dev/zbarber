---
name: Salon ad delivery
description: Visibility and OTA rules for salon video ads.
---

Serve ad videos through a dedicated route that checks both the ad status and the salon's approval on every new media request. Keep video storage separate from regular uploads.

**Why:** A direct media link must stop working when an ad is disabled or its salon is no longer public. Public asset URLs and generic upload cleanup don't enforce the same rules.

**How to apply:** Preserve byte-range support without shared caching. When adding or changing native playback dependencies, use a new Expo runtime and build both profiles before publishing OTA updates for that runtime.

Autoplay starts muted and only one visible ad should play. Let the viewer enable sound for the current video explicitly; don't carry that choice into autoplay for another video or when returning to the carousel. Preserve a viewer’s pause choice when they scroll away and come back. Admin preview is manual and should not mute its audio by default.

On mobile home, place the ad carousel after L’Édito and before the new salons. Its heading is « Salon du mois », with the film icon.

**Why:** the user asked for automatic playback, but scrolling or leaving home must not start background playback or override an explicit pause.

Replacing or deleting a video should detach it before removing the old file, with a durable retry if storage is unavailable. Version public and admin video URLs on replacement.

**Why:** deleting the file first can leave a published ad pointing at a missing file; stable video URLs can mix byte ranges from two versions during playback.

Exclude anonymized salons from ad target selection and reject new links to them. Do not treat every non-approved salon as deleted.

**Why:** account deletion preserves anonymized rows for historical records, and non-deleted salons can still have inactive draft ads.

**How to apply:** filter the ad picker before pagination, using the account-deletion markers rather than a display-name test alone. Preserve the ability to manage ads already linked to a deleted salon.

The ad picker must search the entire eligible catalog before pagination, not just the currently displayed options. Show the total result count so page size is not mistaken for catalog size.

**Why:** the user reported that approved salons were hard to find in the advertisement form.

**How to apply:** keep server-side matching by salon name, city and neighborhood, tolerate accents and mixed search terms, and test a match beyond the first page.
