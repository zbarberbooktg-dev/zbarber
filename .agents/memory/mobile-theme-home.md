---
name: Mobile home theme-awareness
description: Why the mobile home screen needed special work to honor light/day mode, and the overlay-vs-background rule for hard-coded white text.
---

# Mobile home screen + light mode

Some mobile screens historically shipped with a **module-level hard-coded dark palette** instead of consuming the app theme, so light/day mode had no effect there. The home screen (`artifacts/mobile/app/index.tsx`) was one such screen.

The correct pattern (already used by `ThemedRoot` in `app/_layout.tsx`): derive the palette inside the component from `themePref` (AppContext) + `useColorScheme()` + `colors.dark`/`colors.light` from `@/constants/colors`. Compute it before any early return so the loading/spinner state is themed too.

**Why:** a hard-coded palette silently overrides the theme; users toggling day mode see no change on that screen.

**How to apply:** when "X screen ignores light mode," first look for a local `const PALETTE`/hard-coded color object and replace it with theme-derived colors.

## Overlay-vs-background rule for hard-coded `#fff` text

After making a screen theme-aware, audit every hard-coded `#fff`/white text:
- **Keep white** only when the text sits over a dark image overlay (e.g. `ImageBackground` + `rgba(0,0,0,..)` scrim) or on a dark/gold badge or gold button (black text on gold).
- **Tokenize to `PALETTE.text`/foreground** when the text sits on the page background or a themed card/surface — otherwise it becomes white-on-white (invisible) in light mode.

**Why:** light theme `card`/`background`/`surface` are near-white, so any white text on them disappears. This is the most common miss when converting a dark-only screen.

## Brand wordmark color request

The native splash (`app.json`) is just `icon.png` (scissors logo, no text) — there is no editable "Zbarber" text on the native splash. The only "Zbarber" wordmark users see at launch is the home top-bar header. "Make Zbarber black on the splash" maps to that header: render it `foreground` (black) in light mode, keep gold in dark mode.
