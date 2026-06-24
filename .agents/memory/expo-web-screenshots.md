---
name: Expo app screenshots on Replit (Playwright)
description: How to capture real mobile-app screens as store-ready images by driving the Expo *web* build with headless Chromium.
---

# Capturing the real Expo app as images

Use this when asked to generate app-store screenshots (or any "screenshot of the app") of the Expo mobile artifact. The built-in `screenshot` tool's `app_preview` targets the Expo **dev domain** (Metro), which renders blank → it cannot screenshot the app. Drive the Expo **web** build with Playwright instead.

**Why:** the Expo web build renders the actual app UI (real data, fonts, theme) and is screenshot-controllable (viewport, scroll), unlike the Metro dev domain.

**How to apply:**
- Chromium: Playwright's bundled chromium fails on NixOS (`libglib-2.0.so.0` missing). Install the Nix `chromium` system dep and launch Playwright with `executablePath` pointing at `/nix/store/...-chromium-*/bin/chromium`, `args:["--no-sandbox"]`. (The nix path changes per version — resolve it with `readlink -f "$(which chromium)"`.)
- URL: hit the Expo dev server **directly** on its local port (e.g. `http://localhost:18115`), NOT the shared proxy `/mobile/`. The proxy doesn't route the `/node_modules/...entry.bundle` asset (absolute root path) so the app stays blank. On the dev port the app is served at **root `/`**, NOT under the `/mobile/` base prefix — `/mobile/...` shows expo-router's "This screen doesn't exist".
- Waiting: `waitUntil:"networkidle"` never settles (HMR websocket stays open) → use `"domcontentloaded"` + a fixed `waitForTimeout(~12s)` for first bundle + hydration.
- Scrolling: the app is a React Native `ScrollView` (inner scrollable div). `window.scrollTo` does nothing. Use `page.mouse.wheel(0, n)` in steps after `mouse.move` over the content.
- Skip onboarding: seed `localStorage.setItem("gbc.onboarding.v1","1")` via `addInitScript` before navigating to non-onboarding routes.
- Public (unauth) routes only render: `/`, `/salons`, `/salon/:id`, `/onboarding`. `/map` (react-native-maps) and `/gallery` render blank on web; client/barber tabs are Clerk-gated.
- Known web-only glitch: the home "Salons en vedette" horizontal list overlaps its section title on web (fine on native — do NOT change app layout for it). Work around by wheel-scrolling past it (the "Près de chez vous" list below is clean).
- Store format: capture viewport `{width:450,height:800}, deviceScaleFactor:2` → 900x1600 PNG = exactly 9:16, well under 8MB. Cream-bg screens get ~52px black side bars (web artifact) — fill with the content bg via `magick -fill ... -draw "rectangle"`.
