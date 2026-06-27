---
name: Expo splash screen on iOS (white bands + logo size)
description: Why iOS splash shows white borders and how to control logo size in this app (Expo SDK 52, newArch)
---

# Expo splash: white borders & logo size on iOS

**Symptom:** iOS splash shows white letterbox bands and/or an oversized logo.

**Root cause:** Using the legacy top-level `expo.splash` block with a square
image + `resizeMode: contain`. On a tall phone the square is letterboxed, and the
legacy block does **not** reliably apply `backgroundColor` on iOS, so the bands
render **white**. Using the full app icon (rounded card with a baked background)
as the splash image also makes the logo look huge and shows a card edge.

**Fix (the chosen approach):**
- Configure splash via the **`expo-splash-screen` config plugin** (not the legacy
  `expo.splash` key). Remove the legacy block to avoid conflicts.
- Use a **transparent-background logo** (`assets/images/splash-icon.png` — just the
  mark, no card) so the dark background fills edge-to-edge with no visible border.
- Set `backgroundColor: "#0C1118"` (app dark theme) + a matching `dark` variant.
- Control logo size with **`imageWidth`** (currently 200; tune 180–220). This is the
  only knob to change for size — do not revert to the icon/legacy strategy.

**Why:** splash white bands on iOS are a backgroundColor-not-applied problem, not an
image problem; the plugin applies the native background reliably.

**How to apply:** splash config is **native-generated** — changes require a native
rebuild (EAS / `expo prebuild`); they do NOT hot-reload in the dev server. Validate
on an actual iOS build. App icon (`icon.png`) and web favicon are separate and were
left unchanged.
