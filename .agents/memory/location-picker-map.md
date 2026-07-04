---
name: Draggable location-picker map
description: Leaflet-in-WebView draggable-marker picker pattern and its recenter/drag-echo pitfall
---

# Draggable location-picker map (LocationPickerMap)

Reusable picker = Leaflet in a `react-native-webview` (OSM tiles, no API key), single draggable marker, posts settled coords on `dragend`/tap. Mirrors the read-only map in `app/map.tsx` (reuse its `safeJson` escaper + web iframe fallback).

## Recenter without drag-echo loops
The consumer owns a monotonically-increasing `recenterKey` (e.g. `captureSeq`) and bumps it **only** on a fresh external position (new GPS capture) — **never** on a marker drag.

**Why:** if you recenter the map whenever the selected coords change, a drag → onChange → coords change → recenter fires and yanks the map back under the user's finger (a fight/echo loop). Leaflet fires callbacks only on settled positions (dragend/click), so each onChange is one server re-quote — safe to call an API per change.

**How to apply:** pass current lat/lng for value + `recenterKey` for "recenter now". On native, recenter via `injectJavaScript(window.__setMarker(...))`; the web iframe fallback cannot recenter from the key (accepted limitation, mobile-first). Web `message` handler must check `ev.source === iframe.contentWindow` and require both `lat`/`lng` numeric.

## Mandatory distance zones to enable home service
Enabling home service requires ≥1 distance zone, enforced on BOTH client (barber config `handleSave`) and server (`PUT /barbers/me/home-service`). Server rule: use request `zones` if the field is present, else fall back to existing DB zones — so a client omitting `zones` can't bypass the gate.
