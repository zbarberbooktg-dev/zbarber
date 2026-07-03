---
name: Reaching the public home from inside a route group (Expo Router shared-path trap)
description: Why router.replace/push("/") from inside (barber)/(client) never reaches the root gate, and the /browse dedicated-route fix.
---

`app/index.tsx` (`/`) is the public-home gate; it redirects signed-in barbers/admins to `/(barber)`. The barber salon home icon + "Accueil" buttons (barber + client profile) let them view the public home.

**Root cause (confirmed on device):** route groups are non-URL segments, so `app/index.tsx`, `app/(barber)/index.tsx`, and `app/(client)/index.tsx` ALL resolve to `/`. From inside a group, `router.replace("/")` / `push("/")` resolves to *that group's own index*, never the root gate — the gate's render/log never fires. This is NOT a push-vs-replace issue (sign-out's `router.replace("/role-select")` works only because `/role-select` is a *unique* path). No browse-intent flag (query param, module flag, reactive store) can fix it because navigation never reaches the gate.

**Fix:** add a dedicated unambiguous route `app/browse.tsx` that re-exports the public home (`export { default } from "./index"`), register it on the root Stack, and make the gate treat `usePathname() === "/browse"` as force-browse. Buttons `router.push("/browse")` (push, not replace, so the back gesture returns to the dashboard — the public home has no back-to-dashboard control for a signed-in barber).

**Rule / how to apply:** to reach a route that shares a path with sibling group indexes from inside one of those groups, don't navigate to the shared path — give the target a UNIQUE path and navigate to that. Keep any intent flag only as belt-and-suspenders.

**Gotcha:** Replit auto-checkpoints independently commit+push the working tree to `test` ("committiong local changes"), so remote `test` diverges mid-session — expect non-fast-forward pushes and rebase onto `origin/test` (these checkpoint commits are usually empty/no-op filewise). git rebase needs an identity: pass `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env (plain `commit` can use `-c user.email=... -c user.name=...`). Always `rg` for conflict markers after any reconcile before pushing.
