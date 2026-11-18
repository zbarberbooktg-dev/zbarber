---
name: Salon discovery product rules
description: Requested priorities for salon card images, new salons and real map locations.
---

Salon images on the mobile home must prefer an optional salon logo, otherwise the first gallery image, otherwise a default image. Removing a logo must not remove gallery content.

**Why:** the user explicitly requested this priority so each salon is represented by its own branding or work.

**How to apply:** preserve this priority in every home salon-card section and when image references change.

The mobile home needs a separate horizontal section of up to 20 newly added approved salons, ordered by registration date descending (not approval date), with newest ID first for equal dates. Public name search must cover the whole approved catalog, not only records already loaded on the phone. The map uses saved salon coordinates, never fabricated salon locations.

**Why:** the user requested discovery of any salon by name and real salon locations.

**How to apply:** keep public search separate from the small newest-salons preview; exclude unapproved salons from public discovery.

The map must initially request the user's actual current GPS location and show nearby salons around that point. Changing the radius must not recenter on salon bounds or a saved profile city. If GPS is unavailable, explain how to enable it and allow viewing all located salons without inventing a user position. Distinguish load errors from an actual empty radius, and explain that salons without saved coordinates cannot appear on the map.

**Why:** the user explicitly requested an initial user-centered map and working radius searches; an API failure was displayed simultaneously with “0 salon trouvé”.

**How to apply:** retain the GPS center when markers or radius change, filter real coordinates in kilometers, and avoid returning a false empty-search state for permission or network errors.

Public-catalog compatibility matters across independently released mobile apps and backends.

**Why:** the live backend accepted the public paginated salon list but failed on map points and ignored newest sorting while the workspace/test backend supported both. Workspace functionality alone is not proof the installed app's backend supports it.

**How to apply:** preserve the shared complete-catalog compatibility path until backend/mobile capabilities are deliberately coordinated. Load every catalog page before claiming the globally newest twenty or an exhaustive map result. Do not restore reliance on a newer endpoint solely because local tests pass.
