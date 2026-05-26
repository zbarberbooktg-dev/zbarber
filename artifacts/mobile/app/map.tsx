import { Feather } from "@expo/vector-icons";
import { useListServiceCategories } from "@workspace/api-client-react";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const KINSHASA = { lat: -4.4419, lng: 15.2663 };
const RADII = [2, 5, 10, 25, 50] as const;
type Radius = (typeof RADII)[number];

type Barber = {
  id: number;
  salonName: string;
  city: string | null;
  neighborhood: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  rating?: number;
  reviewCount?: number;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

function safeJson(v: unknown) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildLeafletHtml(
  center: { lat: number; lng: number },
  radiusKm: number,
  markers: Array<{ id: number; lat: number; lng: number; name: string; sub: string; rating: number }>,
) {
  const payload = safeJson({
    center: [Number(center.lat) || 0, Number(center.lng) || 0],
    radiusM: Number(radiusKm) * 1000,
    markers: markers.map((m) => ({
      id: Number(m.id),
      lat: Number(m.lat),
      lng: Number(m.lng),
      name: String(m.name ?? ""),
      sub: String(m.sub ?? ""),
      rating: Number(m.rating) || 0,
    })),
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #0A0A0A; }
  .gbc-pin { background: #D4AF37; color: #0A0A0A; border-radius: 999px; padding: 4px 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.5); white-space: nowrap; }
  .gbc-user { width: 14px; height: 14px; background: #3B82F6; border: 2px solid #fff;
    border-radius: 999px; box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
  .leaflet-popup-content-wrapper { background: #141414; color: #F3F0E9; border-radius: 8px; }
  .leaflet-popup-tip { background: #141414; }
  .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, sans-serif; font-size: 13px; }
  .popup-title { font-weight: 700; margin-bottom: 4px; color: #D4AF37; }
  .popup-sub { color: #A09D94; font-size: 11px; margin-bottom: 6px; }
  .popup-btn { display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 6px 10px;
    border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 11px; cursor: pointer; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var data = ${payload};
  var center = data.center;
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '\u00a9 OpenStreetMap'
  }).addTo(map);

  var userIcon = L.divIcon({ className: '', html: '<div class="gbc-user"></div>', iconSize: [14,14], iconAnchor: [7,7] });
  L.marker(center, { icon: userIcon }).addTo(map);
  L.circle(center, { radius: data.radiusM, color: '#D4AF37', weight: 1, fillColor: '#D4AF37', fillOpacity: 0.08 }).addTo(map);

  function send(msg) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }

  function buildPopup(m) {
    var wrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'popup-title';
    title.textContent = m.name;
    wrap.appendChild(title);
    var sub = document.createElement('div');
    sub.className = 'popup-sub';
    sub.textContent = m.sub;
    wrap.appendChild(sub);
    var btn = document.createElement('a');
    btn.className = 'popup-btn';
    btn.href = '#';
    btn.textContent = 'Voir le salon';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      send({ type: 'open', id: m.id });
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function buildPinIcon(m) {
    var el = document.createElement('div');
    el.className = 'gbc-pin';
    var label = m.rating > 0 ? (m.rating.toFixed(1) + ' \u2605') : '\u2702';
    el.textContent = label;
    return L.divIcon({ className: '', html: el.outerHTML, iconAnchor: [20, 14] });
  }

  var bounds = L.latLngBounds([center]);
  data.markers.forEach(function(m) {
    var marker = L.marker([m.lat, m.lng], { icon: buildPinIcon(m) }).addTo(map);
    marker.bindPopup(buildPopup(m));
    bounds.extend([m.lat, m.lng]);
  });

  if (data.markers.length > 0) {
    try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 }); } catch (e) {}
  }
})();
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, t } = useApp();
  const fetcher = useAuthedFetch();
  const webRef = useRef<WebView>(null);

  const [radius, setRadius] = useState<Radius>(5);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [locating, setLocating] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() => {
    if (user?.latitude && user?.longitude) {
      return { lat: Number(user.latitude), lng: Number(user.longitude) };
    }
    return KINSHASA;
  });

  const { data: categories } = useListServiceCategories();

  const fetchBarbers = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: "approved", limit: "100" });
      if (categoryId) qs.set("categoryId", String(categoryId));
      const json = await fetcher(`/api/barbers?${qs.toString()}`);
      setBarbers((json as any)?.data ?? []);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de charger les salons.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, fetcher]);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  const requestLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission refusée", "Autorisez la géolocalisation pour voir les salons proches.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'obtenir la position.");
    } finally {
      setLocating(false);
    }
  };

  const withDistance = useMemo(() => {
    return barbers
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        ...b,
        _km: haversineKm(center, { lat: Number(b.latitude), lng: Number(b.longitude) }),
      }))
      .filter((b) => b._km <= radius)
      .sort((a, b) => a._km - b._km);
  }, [barbers, center, radius]);

  const html = useMemo(
    () =>
      buildLeafletHtml(
        center,
        radius,
        withDistance.map((b) => ({
          id: b.id,
          lat: Number(b.latitude),
          lng: Number(b.longitude),
          name: b.salonName,
          sub: `${b.neighborhood ? b.neighborhood + " • " : ""}${b.city ?? ""} · ${b._km.toFixed(1)} km`,
          rating: b.rating ?? 0,
        })),
      ),
    [center, radius, withDistance],
  );

  const openSalon = React.useCallback(
    (rawId: unknown) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) return;
      router.push(`/salon/${id}` as never);
    },
    [router],
  );

  const onWebMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "open") openSalon(msg.id);
    } catch {}
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      const data = ev?.data;
      if (data && typeof data === "object" && (data as any).type === "open") {
        openSalon((data as any).id);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [openSalon]);

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: PALETTE.border, backgroundColor: PALETTE.bg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={{ flex: 1, color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>
          {t.mapTitle ?? "Salons à proximité"}
        </Text>
        <Pressable
          onPress={requestLocation}
          disabled={locating}
          hitSlop={10}
          style={{ paddingHorizontal: 8, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          {locating ? (
            <ActivityIndicator color={PALETTE.gold} size="small" />
          ) : (
            <Feather name="crosshair" size={16} color={PALETTE.gold} />
          )}
          <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
            {t.mapLocateMe ?? "Ma position"}
          </Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
        <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {t.mapRadius ?? "Rayon de recherche"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {RADII.map((r) => {
            const active = radius === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRadius(r)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: active ? PALETTE.gold : PALETTE.surface,
                  borderWidth: 1, borderColor: active ? PALETTE.gold : PALETTE.border,
                }}
              >
                <Text style={{ color: active ? "#000" : PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {r} km
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {categories && categories.length > 0 && (
          <>
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
              {t.mapServiceType ?? "Type de service"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => setCategoryId(null)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: categoryId === null ? PALETTE.gold : PALETTE.surface,
                  borderWidth: 1, borderColor: categoryId === null ? PALETTE.gold : PALETTE.border,
                }}
              >
                <Text style={{ color: categoryId === null ? "#000" : PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {t.mapAllServices ?? "Tous"}
                </Text>
              </Pressable>
              {categories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryId(active ? null : c.id)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                      backgroundColor: active ? PALETTE.gold : PALETTE.surface,
                      borderWidth: 1, borderColor: active ? PALETTE.gold : PALETTE.border,
                    }}
                  >
                    <Text style={{ color: active ? "#000" : PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      {/* Map */}
      <View style={{ flex: 1, minHeight: 280 }}>
        {Platform.OS === "web" ? (
          // On web, render the leaflet HTML inside an iframe (WebView is limited)
          // @ts-ignore — react-native-web renders div for View; we use raw iframe
          <iframe
            srcDoc={html}
            sandbox="allow-scripts"
            style={{ border: 0, width: "100%", height: "100%" }}
            title="map"
          />
        ) : (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html }}
            onMessage={onWebMessage}
            style={{ backgroundColor: PALETTE.bg }}
          />
        )}
      </View>

      {/* Results bar */}
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: PALETTE.border,
        backgroundColor: PALETTE.bg, maxHeight: 220,
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {loading
              ? (t.loading ?? "Chargement…")
              : `${withDistance.length} ${withDistance.length > 1 ? (t.salonsFound ?? "salons trouvés") : (t.salonFound ?? "salon trouvé")}`}
          </Text>
          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {radius} km
          </Text>
        </View>
        <FlatList
          data={withDistance}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {t.noSalonsInRadius ?? "Aucun salon dans ce rayon. Élargissez la zone."}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/salon/${item.id}` as never)}
              style={({ pressed }) => ({
                width: 200, padding: 12, backgroundColor: PALETTE.surface,
                borderWidth: 1, borderColor: PALETTE.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text numberOfLines={1} style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {item.salonName}
              </Text>
              <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                {item.neighborhood ? `${item.neighborhood} • ` : ""}{item.city}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="navigation" size={10} color={PALETTE.gold} />
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                    {item._km.toFixed(1)} km
                  </Text>
                </View>
                {item.rating && item.rating > 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Feather name="star" size={10} color={PALETTE.gold} />
                    <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      {Number(item.rating).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}
