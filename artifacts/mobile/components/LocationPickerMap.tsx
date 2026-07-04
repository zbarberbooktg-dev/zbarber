import React, { useEffect, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

function safeJson(v: unknown) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildHtml(lat: number, lng: number, tint: string, bg: string) {
  const payload = safeJson({
    lat: Number(lat) || 0,
    lng: Number(lng) || 0,
    tint: String(tint),
    bg: String(bg),
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${bg}; }
  .pin { width: 20px; height: 20px; background: ${tint}; border: 3px solid #fff;
    border-radius: 999px; box-shadow: 0 0 0 5px rgba(0,0,0,0.25); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var d = ${payload};
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([d.lat, d.lng], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var icon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
  var marker = L.marker([d.lat, d.lng], { draggable: true, icon: icon }).addTo(map);
  function send() {
    var p = marker.getLatLng();
    var msg = { lat: p.lat, lng: p.lng };
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }
  marker.on('dragend', send);
  map.on('click', function(e) { marker.setLatLng(e.latlng); send(); });
  window.__setMarker = function(lat, lng) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  };
})();
</script>
</body>
</html>`;
}

type Props = {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  /** Bump this to recenter the map/marker on a fresh external position (e.g. new GPS capture). */
  recenterKey?: number | string;
  height?: number;
  tint?: string;
  background?: string;
};

/**
 * Interactive location picker: a Leaflet map (OpenStreetMap tiles, no API key)
 * rendered in a WebView with a single draggable marker. Dragging or tapping the
 * map reports the settled coordinates via `onChange`. A drag does NOT bump
 * `recenterKey`, so the map stays put; only a caller-driven `recenterKey` change
 * recenters it (used when the user re-captures GPS).
 */
export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  recenterKey,
  height = 220,
  tint = "#D4AF37",
  background = "#0A0A0A",
}: Props) {
  const ref = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const initial = useRef({ latitude, longitude });
  const html = useMemo(() => buildHtml(initial.current.latitude, initial.current.longitude, tint, background), [tint, background]);

  // Recenter the marker when the caller signals a fresh external position.
  useEffect(() => {
    if (recenterKey === undefined) return;
    ref.current?.injectJavaScript(`window.__setMarker && window.__setMarker(${Number(latitude)}, ${Number(longitude)}); true;`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  const emit = (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (typeof d?.lat === "number" && typeof d?.lng === "number") onChange(d.lat, d.lng);
    } catch {}
  };

  const onMessage = (e: WebViewMessageEvent) => emit(e.nativeEvent.data);

  // On web, the iframe posts a structured message object to the parent window.
  // Only accept messages from our own iframe with strictly numeric coordinates.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      if (iframeRef.current && ev.source !== iframeRef.current.contentWindow) return;
      const data = ev?.data as { lat?: unknown; lng?: unknown } | null;
      if (data && typeof data.lat === "number" && typeof data.lng === "number") {
        onChange(data.lat, data.lng);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={{ height, overflow: "hidden", borderRadius: 8 }}>
        {/* @ts-ignore react-native-web renders a div; we embed a raw iframe */}
        <iframe ref={iframeRef} srcDoc={html} sandbox="allow-scripts" style={{ border: 0, width: "100%", height: "100%" }} title="location" />
      </View>
    );
  }

  return (
    <View style={{ height, overflow: "hidden", borderRadius: 8 }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={{ backgroundColor: background }}
      />
    </View>
  );
}
