---
name: 360° panorama viewer (Pannellum in WebView)
description: Constraints for rendering equirectangular 360° tours in a RN WebView / web iframe via Pannellum.
---

# 360° panorama viewer

Multi-scene salon virtual tour: barbers upload equirectangular panoramas (scenes), public navigates between them in a fullscreen viewer. Viewer renders Pannellum (CDN) inside a `WebView` (native) or `<iframe srcDoc>` (web).

## WebGL texture is CORS-sensitive
Pannellum textures the panorama into a WebGL canvas with `crossOrigin: "anonymous"`. If the image is cross-origin and the host doesn't send CORS headers, the texture taints and rendering fails.
**How to apply:** on native, set the WebView `source.baseUrl` to the image's origin (derive from the resolved object URL — same as `EXPO_PUBLIC_DOMAIN`) so it's same-origin. Web iframe `srcDoc` has an opaque origin, so web panoramas can still taint unless the storage endpoint emits CORS headers — native is the primary target.

## Untrusted strings in the inline <script> = stored XSS
Scene `title`/`imageUrl` come from the DB and get interpolated into an inline `<script>` via `JSON.stringify(config)`. `JSON.stringify` does NOT escape `</script>`, so a malicious value breaks out and runs arbitrary JS for every public viewer.
**Why:** flagged in review as a stored script-injection.
**How to apply:** escape `<` → `\u003c` in the serialized config before embedding. Also validate `imageUrl` server-side to be an `/objects/...` storage path (reject external/inline URLs) and cap `title` length.

## Scene switching differs by platform
Native: `webRef.injectJavaScript("window.loadScene('<id>')")`. Web iframe: `iframeRef.contentWindow.postMessage({loadScene}, "*")` with a `message` listener in the HTML. Wire BOTH or web chips silently do nothing. Reset the active-scene state when the modal opens or chips drift from the displayed panorama.
