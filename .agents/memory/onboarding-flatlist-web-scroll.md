---
name: Onboarding FlatList scrollToIndex on web
description: react-native-web FlatList.scrollToIndex doesn't visually paginate in headless/test browsers, even though state updates correctly.
---

The onboarding carousel (`artifacts/mobile/app/onboarding.tsx`) uses a horizontal `pagingEnabled` `FlatList` with `scrollToIndex()` to advance slides on CTA tap.

On react-native-web (including the Playwright-driven `runTest` e2e subagent), `scrollToIndex()` often does not visually scroll the list even though `currentIdx` state and the accessibility tree update correctly (all slide content is present, just not visually active/scrolled into view).

**Why:** `react-native-web`'s FlatList/ScrollView doesn't fully implement native scroll offset animation driven by imperative `scrollToIndex` in headless browser contexts.

**How to apply:** Treat "slide didn't visually advance" bug reports in e2e tests against this screen as a known web-preview limitation, not a real regression — verify via the accessibility tree / DOM text content instead of screenshots when testing onboarding slide copy on web. Real native (iOS/Android) behavior is unaffected.
