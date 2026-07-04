---
name: Layout redirecting to a screen inside itself loops
description: Why a group _layout that <Redirect>s to one of its own child routes causes "Maximum update depth exceeded".
---

**Rule:** an expo-router group `_layout` (e.g. `(barber)/_layout.tsx`) must NOT unconditionally `<Redirect href="/(group)/child" />` to a route that lives **inside that same layout**. The redirect target re-mounts the layout, which re-evaluates the same condition and fires the redirect again → infinite loop → "Maximum update depth exceeded" → blank screen.

**Why:** the guard condition is state-based (e.g. barber status !== approved), not path-aware, so it stays true even after you've arrived at the target child. `<Redirect>` runs during render every render.

**How to apply:** gate the redirect on the current route. Read `useSegments()` and skip the redirect when already there: `const onPending = segments[segments.length-1] === "pending"; if (blocked && !onPending) return <Redirect .../>;` then fall through to render the navigator so the target screen shows. Hide the other tabs (`href: null`) while blocked so only the gate screen is reachable. Redirecting to a route in a *sibling* group (e.g. `(barber)` → `(client)`) is fine — no self-loop.
