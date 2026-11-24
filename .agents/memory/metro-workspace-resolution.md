---
name: Metro workspace resolution
description: Keep Expo imports from sibling workspace packages reliable with pnpm on Windows.
---

When a native workspace package import fails only in a Windows/hoisted-pnpm
Metro bundle, map the Expo app's documented source subpaths to explicit paths
under that workspace package and add that package to Metro's `watchFolders`.
Continue to declare the package as an application dependency; verify with both
Android and iOS JavaScript exports.

**Why:** package-export wildcard resolution and workspace junction watching can
differ between Metro's isolated Linux layout and the hoisted layout used by
Windows Android builds.

**How to apply:** use the targeted Metro resolver for affected `@workspace/*`
imports and test a full Android bundle rather than relying on TypeScript alone.
