---
name: Stable fetch hooks over Clerk getToken
description: Any hook that wraps @clerk/expo getToken must return a referentially-stable callback, or consumers that list it in effect deps spin into "Maximum update depth exceeded".
---

# Stabilize hooks built on @clerk/expo getToken

`getToken` from `@clerk/expo` has an **unstable identity** — a new function every render. A hook like `useAuthedFetch` that wraps it must NOT pass `getToken` in its `useCallback`/`useMemo` deps, or the returned fetcher changes every render.

**Why:** A consumer that puts the unstable fetcher in a dependency array (e.g. `fetchX = useCallback(..., [fetcher])` + `useEffect(() => fetchX(), [fetchX])`) re-runs the effect every render; if the effect sets state, it's an infinite render loop → "Maximum update depth exceeded". This actually bit `app/map.tsx` (the fetcher was in `[categoryId, fetcher]`).

**How to apply:** Wrap getToken-based fetchers with the latest-ref pattern and empty deps:

```ts
const getTokenRef = useRef(getToken);
useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
return useCallback(async (...) => { const token = await getTokenRef.current(); ... }, []);
```

Sync the ref inside an effect (not during render) for concurrent-render purity. This is the same closure/ref strategy already used in `AppContext` for `setAuthTokenGetter`. Returned callback deps must be `[]` (or another truly stable value) — never `[getToken]`.
