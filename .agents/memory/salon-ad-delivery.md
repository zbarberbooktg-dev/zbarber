---
name: Salon ad delivery
description: Visibility and OTA rules for salon video ads.
---

Serve ad videos through a dedicated route that checks both the ad status and the salon's approval on every new media request. Keep video storage separate from regular uploads.

**Why:** A direct media link must stop working when an ad is disabled or its salon is no longer public. Public asset URLs and generic upload cleanup don't enforce the same rules.

**How to apply:** Preserve byte-range support without shared caching. When adding or changing native playback dependencies, use a new Expo runtime and build both profiles before publishing OTA updates for that runtime.

Home autoplay must start muted and only one visible ad should play. Keep the accessible speaker icon toggle without visible text. Preserve a viewer’s pause choice when they scroll away and come back. Admin preview is manual and should not mute its audio by default.

**Why:** the user's full homepage redesign brief superseded the earlier request for sound on by default and explicitly requires silent previews that do not slow down home.

**How to apply:** keep playback visibility-checked, default the active ad to muted, and expose an accessible icon-only audio toggle per video. Do not change admin preview behavior.

The expanded ad view should keep one native player and one video surface. On web, keep only one HTML video element, capture playback time before moving the surface, and restore it once the replacement element has loaded metadata. Catch playback promises at the media adapter: ignore expected AbortError cancellations, but expose autoplay denial or actual playback failures.

**Why:** Expo Video's web player discards the HTML play promise. Removing a playing element during expansion or viewport changes can otherwise cause an unhandled rejection; remounting also loses playback position.

On the redesigned mobile home, place the ad carousel after categories and before proximity. Keep Journal Zbarber lower, after Inspiration. The ad heading is « Salon du mois », with the film icon.

**Why:** the approved full-home brief superseded the earlier placement after L’Édito. Visibility checks must still prevent background playback or overriding an explicit pause.

Replacing or deleting a video should detach it before removing the old file, with a durable retry if storage is unavailable. Version public and admin video URLs on replacement.

**Why:** deleting the file first can leave a published ad pointing at a missing file; stable video URLs can mix byte ranges from two versions during playback.

Exclude anonymized salons from ad target selection and reject new links to them. Do not treat every non-approved salon as deleted.

**Why:** account deletion preserves anonymized rows for historical records, and non-deleted salons can still have inactive draft ads.

**How to apply:** filter the ad picker before pagination, using the account-deletion markers rather than a display-name test alone. Preserve the ability to manage ads already linked to a deleted salon.

The ad picker must search the entire eligible catalog before pagination, not just the currently displayed options. Show the total result count so page size is not mistaken for catalog size.

**Why:** the user reported that approved salons were hard to find in the advertisement form.

**How to apply:** keep server-side matching by salon name, city and neighborhood, tolerate accents and mixed search terms, and test a match beyond the first page.
