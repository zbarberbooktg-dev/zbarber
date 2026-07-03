---
name: Escaping a redirect-gated default landing from inside a nested navigator
description: How a barber/admin reaches the redirect-gated public home from inside the (barber) Tabs — use router.replace to a root sibling, not a bypass flag.
---

`app/index.tsx` redirects signed-in barbers/admins to `/(barber)` by default. The barber home icon + "Accueil" buttons let them reach the public home anyway.

**Rule:** to escape a redirect-gated default landing to a *root-sibling* screen from inside a nested navigator (Tabs), use `router.replace("/<sibling>")` — not `navigate`/`push`.
**Why:** `navigate`/`push` to `"/"` get captured by the current nested navigator and never reliably reach the root Stack's `index`, so the gate keeps bouncing the user back. No bypass-flag variant (query param, one-shot module flag, reactive store) fixes this because the flag was never the problem — the call was. `replace` to a root sibling works (proven: sign-out does `router.replace("/role-select")`).
**How to apply:** set any bypass intent, then `router.replace(...)`; don't burn time iterating on flag mechanisms first. Keep a flag as belt-and-suspenders only.
