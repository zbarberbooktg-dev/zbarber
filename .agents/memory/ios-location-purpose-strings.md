---
name: iOS location purpose strings
description: App Review requirement for explicit native location usage descriptions in Expo builds.
---

Set `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`, and `NSLocationAlwaysAndWhenInUseUsageDescription` explicitly and verify them with Expo config introspection before submitting an iOS build.

**Why:** Configuring only the Expo location plugin's combined permission text can still leave one or more generated `Info.plist` keys with the generic “Allow the app to access your location” text, which Apple rejects.

**How to apply:** Whenever location permissions or Expo configuration changes, inspect the generated native configuration and confirm every generated location purpose string states the feature, data use, and a concrete example.