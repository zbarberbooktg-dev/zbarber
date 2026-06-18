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

5. **`EXPO_ROUTER_APP_ROOT` undefined at bundle time.** After the APK installs, Metro
   bundling fails: "Invalid call ... `process.env.EXPO_ROUTER_APP_ROOT` / first argument of
   `require.context` should be a string". In this monorepo the CLI's app-root auto-detection
   flakes on Windows. Fix: set `EXPO_ROUTER_APP_ROOT=<abs path to artifacts/mobile/app>`
   (shell `set`, or add to the gitignored local `artifacts/mobile/.env`) and restart Metro
   with `-c`. babel-preset-expo + metro.config are already correct (Replit works), so don't
   touch them.
