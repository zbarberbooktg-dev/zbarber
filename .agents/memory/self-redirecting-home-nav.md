---
name: Self-redirecting home + one-shot browse intent
description: Why signed-in barber/admin "Accueil" nav to the public home uses a module flag, not a query param.
---

The public home (`artifacts/mobile/app/index.tsx`) redirects signed-in barbers/admins to `/(barber)` by default. To let them view the public home anyway, use the one-shot `browseIntent` module flag (mirrors `authIntent`), NOT only a query param.

**Why:** the "Accueil" button used `router.push("/?browse=1")` and the home gate read `browse` via `useLocalSearchParams`. That param round-trip through a screen that redirects-by-default is fragile from inside a nested Tabs navigator — it intermittently landed back on the Salon tab. A module-level flag is delivery-independent and reliable.

**How to apply:** callers `setBrowseIntent()` then navigate; the home screen captures `useState(() => consumeBrowseIntent())` once per mount and skips the redirect when set. Keep the `?browse=1` check too as belt-and-suspenders (covers screen-instance reuse where the useState initializer doesn't re-run). Any future "let a redirect-gated role escape its default landing" case should reach for the same flag pattern rather than a query param.
