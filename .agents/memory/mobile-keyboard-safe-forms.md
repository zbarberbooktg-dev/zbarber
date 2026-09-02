---
name: Mobile keyboard-safe forms
description: Convention for keeping Zbarber mobile fields and actions accessible above native keyboards.
---

All mobile forms with editable fields should use the shared keyboard-aware scroll behavior. Submit actions must remain inside the scrollable form instead of being absolutely pinned over its bottom edge.

**Why:** Native Android and small-screen iOS keyboards can cover focused fields and fixed bottom actions even when a plain ScrollView or an iOS-only KeyboardAvoidingView appears correct in the web preview.

**How to apply:** Use the shared keyboard-aware form container with a bottom offset, preserve handled taps and interactive dismissal, include the device bottom safe area, and keep the final action in scroll content. Verify new long forms with text, numeric, and phone keyboards.