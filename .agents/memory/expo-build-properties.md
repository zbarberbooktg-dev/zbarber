---
name: expo-build-properties config plugin must be installed
description: Why expo start / eas build fail with PluginError on expo-build-properties, and the Android packaging fix it carries.
---

# Expo config plugins must be declared as dependencies

`artifacts/mobile/app.json` lists `expo-build-properties` in `expo.plugins`. Expo
resolves every config plugin against installed node_modules at config-eval time
(`expo start`, `eas build`, any `getConfig`). If the plugin's module is referenced
in app.json but NOT a declared dependency, you get:
`PluginError: Failed to resolve plugin for module "expo-build-properties" ... Do you
have node modules installed?` and the dev workflow exits non-zero.

**Why it bit us:** the plugin was referenced in app.json but missing from
`artifacts/mobile/package.json` deps. A previously-phantom install masked it; a clean
`pnpm install` (or lockfile regen) dropped the undeclared package and the workflow
broke. Fix: `pnpm --filter @workspace/mobile exec expo install expo-build-properties`
(installs the SDK-compatible version, ~1.0.x for SDK 54, and declares it).

**How to apply:** any plugin name in `expo.plugins` must have a matching entry in the
mobile package's dependencies. When a plugin error appears, install the package with
`expo install` rather than removing the plugin — unless the plugin entry is a bare
string with no config (then it's a no-op and safe to drop).

**Lurking risk on the GitHub `test` branch:** the merge into `test` took the remote's
app.json, which had `expo-build-properties` REMOVED entirely. That plugin carried a
real Android fix — `android.packagingOptions.exclude` of
`META-INF/versions/9/OSGI-INF/MANIFEST.MF`. Without it, Android EAS builds can fail on
a duplicate-file packaging error. If Android builds from `test` break that way, re-add
expo-build-properties + the packagingOptions exclude.

**Version mismatch note:** `expo-document-picker@56.0.4` is pinned but Expo SDK 54
expects `~14.0.8`; `expo start` warns about it. It bundles, but document-picker
behavior may be off — revisit if file-picking misbehaves.
