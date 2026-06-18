---
name: Windows local Expo Android native build
description: Fixes required to run `expo run:android` for the mobile artifact on a Windows dev machine in this pnpm monorepo (path-length, dup-resource, ninja, expo-router app root).
---

# Building the Expo Android app natively on Windows (`npx expo run:android`)

Doing a local native Android build on Windows (project at e.g. `C:\zbarber`, monorepo)
hits a chain of environment-specific failures. None reproduce on Replit/EAS (Linux).
In order encountered, the durable fixes:

1. **node_modules path length → `node-linker=hoisted`.** Put `node-linker=hoisted` in the
   **user-global** `%USERPROFILE%\.npmrc`, NOT the tracked repo `.npmrc` (keeps Linux
   servers/EAS on default isolated linker). Isolated pnpm double-nests RN native libs
   (`node_modules/.pnpm/<pkg>@<hash>/node_modules/<pkg>/...`) which blows past
   `CMAKE_OBJECT_PATH_MAX`. Hoisted flattens it. After setting it, force a clean reinstall
   (rename `node_modules` then `pnpm install`; avoid robocopy /MIR for deletes).
   **Why:** the repo `.npmrc` is shared; hoisting there would change server/CI installs.

2. **Duplicate JAR resource → `expo-build-properties` packagingOptions (in repo).**
   `:app:mergeDebugJavaResource` fails with "2 files found with path
   `META-INF/versions/9/OSGI-INF/MANIFEST.MF`" (from `org.jspecify` + okhttp
   `logging-interceptor`). Fix lives in `artifacts/mobile/app.json` via the
   `expo-build-properties` plugin → `android.packagingOptions.exclude`. This is the one fix
   that belongs in the repo (it also protects EAS/prod builds). If more dup files appear,
   add them to the same `exclude` list.

3. **Windows MAX_PATH (260) → replace bundled ninja, not just the registry flag.**
   `react-native-keyboard-controller` codegen produces a ~358-char object path
   (`...react_codegen_reactnativekeyboardcontroller.dir/C_/.../RNKCKeyboardBackgroundViewShadowNode.cpp.o`).
   Path-shortening tricks (`subst`, root-hoist, moving the repo) CANNOT get under 260 —
   CMake mirrors the full source path INTO the `.dir`, so the generated names appear twice.
   Setting `HKLM\...\FileSystem\LongPathsEnabled=1` is necessary but **NOT sufficient**:
   Android's `cmake/3.22.1` bundles an old ninja (~1.10) that ignores it. Replace
   `%LOCALAPPDATA%\Android\Sdk\cmake\3.22.1\bin\ninja.exe` with **ninja 1.12.1**
   (long-path-aware manifest); with LongPathsEnabled on, the build then succeeds.
   **Why:** the limit must be lifted at the tool level; you can't shrink this path enough.

4. **`expo run:android` prebuild prompt rewrites package.json (local only).** It offers to
   "install updated dependencies (expo/react/react-native)" and may overwrite `catalog:`
   refs with concrete versions. Safe to accept for a local build; it's gitignored-by-intent
   only in spirit — revert with `git checkout -- artifacts/mobile/package.json` before any
   push so the catalog setup stays intact on `test`.

5. **`EXPO_ROUTER_APP_ROOT` not inlined → bundle fails (caused by fix #1's hoisted linker).**
   After the APK installs, Metro bundling fails: "Invalid call ... `process.env.EXPO_ROUTER_APP_ROOT`
   / first argument of `require.context` should be a string" in `expo-router/_ctx.<platform>.js`.
   **Root cause (verified by reading babel-preset-expo source):** the EXPO_ROUTER_* env vars are
   inlined by a Babel plugin that `babel-preset-expo` only registers when its internal
   `hasModule("expo-router")` (a `require.resolve`) succeeds. The plugin reads its inputs from
   Babel's `caller` (NOT `process.env`), so **setting the env var has zero effect** — that was a
   wrong early guess. Under fix #1's `node-linker=hoisted` layout, `babel-preset-expo` and
   `expo-router` resolve to different `node_modules` trees, so `hasModule` returns false and the
   plugin is silently skipped → the raw `process.env.EXPO_ROUTER_APP_ROOT` survives → Metro errors.
   On Replit/EAS (isolated linker) resolution succeeds, so it never reproduces there.
   **Fix (in repo, `artifacts/mobile/babel.config.js`):** add a small self-contained Babel plugin
   that re-implements the same inlining (EXPO_PROJECT_ROOT, EXPO_ROUTER_IMPORT_MODE,
   EXPO_ROUTER_ABS_APP_ROOT, EXPO_ROUTER_APP_ROOT), reading from `this.file.opts.caller` per file
   (cache-safe) with no module-resolution dependency. It runs before the preset and is idempotent
   on layouts where the preset's own plugin still runs. **Why a repo fix, not an env var:** the env
   var can't work (plugin ignores it), and the inlining must happen regardless of node-linker layout.
   **How to verify standalone:** transform `_ctx.android.js` through `@babel/core` with ONLY this
   plugin + a metro-like caller (`{platform:"android",projectRoot:<mobile>,routerRoot:"./app",isDev:true}`)
   and confirm `process.env.EXPO_ROUTER_APP_ROOT` becomes a relative string and `_IMPORT_MODE` → `"sync"`.

6. **App builds+installs but crashes at launch: `NoClassDefFoundError` for an `expo.modules.kotlin.*`
   class (e.g. `AnyTypeCache`) → an `expo-*` package pinned to a future-SDK major.** A single
   off-SDK Expo package (here `expo-document-picker@^56.0.4` while everything else was SDK 54)
   depends on a newer `expo-modules-core` API that the SDK-pinned `expo-modules-core` (3.0.30) does
   not contain. It still **compiles** (autolinking + Gradle resolve the newer module's classpath),
   so the native build succeeds, then crashes during TurboModule init with
   `java.lang.ClassNotFoundException: ...AnyTypeCache` at `DocumentPickerModule.definition`.
   **Invisible on Replit/EAS:** Replit never builds native (Metro only bundles iOS/web), and EAS
   uses SDK-aligned versions, so neither surfaces the mismatch. **Fix:** pin every `expo-*` package
   to its SDK version from `node_modules/expo/bundledNativeModules.json` (or `npx expo install --check`);
   then clean-rebuild. **How to spot:** the crashing class lives in `expo-modules-core` but is absent
   from the installed version's source (`rg AnyTypeCache .../expo-modules-core` → no hits) while a
   peer module references it — that gap = an off-SDK Expo dep, not a stale build.
