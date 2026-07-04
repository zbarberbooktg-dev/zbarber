---
name: useAuthedFetch is unstable — never in effect/callback deps
description: Why putting the mobile fetcher (or getToken) in a dependency array causes an infinite render loop.
---

**Rule:** the mobile `useAuthedFetch()` fetcher (and `getToken` from `@clerk/expo`) has a **new identity every render**. Never list it in a `useEffect` / `useCallback` / `useMemo` dependency array, and never make it a query key. Read it via closure instead and exclude it with an eslint-disable.

**Why:** `@clerk/expo`'s `getToken` is fresh each render; `useAuthedFetch`'s `useCallback` depends on `getToken`, so the returned fetcher is fresh too. A `useCallback([...,fetcher])` → `useEffect([thatCallback])` chain fires the effect every render, whose setState re-renders → new fetcher → loops forever = "Maximum update depth exceeded". It only surfaces once **authenticated** (before sign-in the token getter churn is quieter), which is why it looks like a "post-login" or "only via Expo Go" bug.

**How to apply:** when a screen fetches via the authed fetcher inside a callback/effect, depend only on the real inputs (e.g. `[categoryId]`), not the fetcher. Grep for `fetcher` / `getToken` inside dependency arrays as a smell. `AppContext` already documents this for its own effects.
