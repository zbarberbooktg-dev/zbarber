import { Feather } from "@expo/vector-icons";
import { useApprovedSalonCatalog, useListServiceCategories } from "@workspace/api-client-react";
import * as Location from "expo-location";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { coordinates, nearbySalons, type Coordinates } from "@/lib/salonSearch";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const RADII = [2, 5, 10, 25, 50] as const;
type Radius = (typeof RADII)[number];

function safeJson(v: unknown) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildLeafletHtml(
  center: Coordinates | null,
  radiusKm: number,
  markers: Array<{ id: number; lat: number; lng: number; name: string; sub: string; rating: number }>,
  userPosition: { lat: number; lng: number } | null,
  showRadius: boolean,
) {
  const payload = safeJson({
    center: center ? [center.lat, center.lng] : [20, 0],
    radiusM: Number(radiusKm) * 1000,
    userPosition: userPosition ? [userPosition.lat, userPosition.lng] : null,
    showRadius,
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
  .gbc-marker { background: transparent; border: 0; }
  .gbc-pin { position: relative; width: 44px; height: 54px;
    filter: drop-shadow(0 3px 4px rgba(0,0,0,.32)); }
  .gbc-pin::after { content: ''; position: absolute; width: 13px; height: 13px;
    background: ${PALETTE.gold}; border-radius: 0 0 3px 0; left: 15.5px; top: 34px;
    transform: rotate(45deg); z-index: 0; }
  .gbc-pin-head { position: relative; z-index: 1; display: flex; align-items: center;
    justify-content: center; width: 38px; height: 38px; box-sizing: border-box;
    margin: 2px 3px; border: 3px solid ${PALETTE.gold}; border-radius: 50%;
    background: ${PALETTE.surface}; color: ${PALETTE.gold};
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); transition: transform .16s, background .16s, color .16s; }
  .gbc-pin-head svg { width: 21px; height: 21px; }
  .gbc-pin-rating { position: absolute; z-index: 2; right: -9px; top: -4px;
    padding: 3px 5px; border: 2px solid ${PALETTE.surface}; border-radius: 9px;
    background: ${PALETTE.gold}; color: ${PALETTE.bg}; font: 700 10px/1 -apple-system, sans-serif; }
  .gbc-marker:hover .gbc-pin-head, .gbc-marker:focus-visible .gbc-pin-head,
  .gbc-marker.is-selected .gbc-pin-head { background: ${PALETTE.gold}; color: ${PALETTE.bg}; transform: translateY(-3px); }
  .gbc-marker:focus-visible { outline: 2px solid ${PALETTE.gold}; outline-offset: 3px; border-radius: 22px; }
  @media (prefers-reduced-motion: reduce) { .gbc-pin-head { transition: none; } }
  .gbc-user { width: 14px; height: 14px; background: #3B82F6; border: 2px solid #fff;
    border-radius: 999px; box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
  .leaflet-popup-content-wrapper { background: #141414; color: #F3F0E9; border-radius: 14px;
    border: 1px solid ${PALETTE.gold}; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
  .leaflet-popup-tip { background: #141414; }
  .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, sans-serif; font-size: 13px; }
  .popup-title { font-weight: 700; margin-bottom: 4px; color: #D4AF37; overflow-wrap: anywhere; }
  .popup-sub { color: #A09D94; font-size: 11px; margin-bottom: 6px; }
  .popup-btn { display: block; text-align: center; background: #D4AF37; color: #0A0A0A; padding: 10px 12px;
    border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 12px; cursor: pointer; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var data = ${payload};
  var center = data.center;
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView(center, data.userPosition ? 13 : 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '\u00a9 OpenStreetMap'
  }).addTo(map);

  var userIcon = L.divIcon({ className: '', html: '<div class="gbc-user"></div>', iconSize: [14,14], iconAnchor: [7,7] });
  if (data.userPosition) {
    L.marker(data.userPosition, { icon: userIcon }).addTo(map);
    if (data.showRadius) {
      var circle = L.circle(data.userPosition, { radius: data.radiusM, color: '#D4AF37', weight: 1, fillColor: '#D4AF37', fillOpacity: 0.08 }).addTo(map);
      map.fitBounds(circle.getBounds(), { padding: [12, 12], maxZoom: 15 });
    }
  }

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
    var head = document.createElement('div');
    head.className = 'gbc-pin-head';
    // Static vector artwork, never user-generated HTML or a device-dependent emoji.
    head.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.12 8.12 21 21M8.12 15.88 21 3"/></svg>';
    el.appendChild(head);
    if (m.rating > 0) {
      var rating = document.createElement('span');
      rating.className = 'gbc-pin-rating';
      rating.textContent = m.rating.toFixed(1);
      el.appendChild(rating);
    }
    return L.divIcon({ className: 'gbc-marker', html: el.outerHTML,
      iconSize: [44,54], iconAnchor: [22,48], popupAnchor: [0,-42] });
  }

  var bounds = L.latLngBounds(data.userPosition ? [data.userPosition] : []);
  data.markers.forEach(function(m) {
    var marker = L.marker([m.lat, m.lng], { icon: buildPinIcon(m), title: m.name,
      alt: 'Salon : ' + m.name, keyboard: true, riseOnHover: true }).addTo(map);
    marker.bindPopup(buildPopup(m), { minWidth: 160, maxWidth: 230 });
    marker.on('popupopen', function() {
      marker.getElement().classList.add('is-selected');
      marker.setZIndexOffset(1000);
    });
    marker.on('popupclose', function() {
      marker.getElement().classList.remove('is-selected');
      marker.setZIndexOffset(0);
    });
    bounds.extend([m.lat, m.lng]);
  });

  // Nearby and all-salon results must never override the actual user's center.
  if (!data.userPosition && data.markers.length > 0) {
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
  const { t } = useApp();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [radius, setRadius] = useState<Radius>(5);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [center, setCenter] = useState<Coordinates | null>(null);
  const locationRequest = useRef(false);
  const mounted = useRef(true);
  const locationVersion = useRef(0);

  const { data: categories } = useListServiceCategories();
  const { data: barbers, isLoading: loading, isError, refetch } = useApprovedSalonCatalog({ categoryId: categoryId ?? undefined });
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));

  const requestLocation = async () => {
    if (locationRequest.current) return;
    locationRequest.current = true;
    const version = ++locationVersion.current;
    const current = () => mounted.current && locationVersion.current === version;
    setLocating(true);
    setLocationError(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const perm = await requestPermission();
      if (!current()) return;
      if (!perm.granted) {
        if (current()) setLocationError("Autorisez la localisation pour rechercher les salons autour de vous, ou choisissez « Tous les salons ».");
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("GPS timeout")), 20000); }),
      ]);
      if (!current()) return;
      const point = coordinates(pos.coords.latitude, pos.coords.longitude);
      if (!point) throw new Error("Invalid GPS");
      setCenter(point);
    } catch {
      if (current()) setLocationError("Position introuvable. Activez la localisation de votre téléphone puis réessayez avec « Ma position ».");
    } finally {
      clearTimeout(timer);
      if (current()) { locationRequest.current = false; setLocating(false); }
    }
  };

  useEffect(() => {
    mounted.current = true;
    void requestLocation();
    return () => {
      mounted.current = false;
      locationRequest.current = false;
      locationVersion.current += 1;
    };
    // Request GPS once on entry, not every time the permission hook updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withDistance = useMemo(() => nearbySalons(barbers, center, showAll ? null : radius), [barbers, center, radius, showAll]);
  const missingPositions = barbers.filter((b) => !coordinates(b.latitude, b.longitude)).length;

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
          sub: `${b.neighborhood ? b.neighborhood + " • " : ""}${b.city ?? ""}${b._km === null ? "" : ` · ${b._km.toFixed(1)} km`}`,
          rating: b.rating ?? 0,
        })),
        center,
        !showAll,
      ),
    [center, radius, withDistance, barbers, showAll],
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
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
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
        paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top) + 12, paddingHorizontal: 14, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: PALETTE.border, backgroundColor: PALETTE.bg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={{ flex: 1, color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>
          {t.mapTitle ?? "Salons à proximité"}
        </Text>
        <Pressable
          testID="map-locate-me"
          onPress={() => { setShowAll(false); void requestLocation(); }}
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
          <Pressable testID="map-show-all" onPress={() => setShowAll(true)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: showAll ? PALETTE.gold : PALETTE.surface }}>
            <Text style={{ color: showAll ? PALETTE.bg : PALETTE.text }}>Tous les salons</Text>
          </Pressable>
          {RADII.map((r) => {
            const active = !showAll && radius === r;
            return (
              <Pressable
                key={r}
                testID={`map-radius-${r}`}
                onPress={() => { setRadius(r); setShowAll(false); if (!center) void requestLocation(); }}
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
        {!center && !showAll ? (
          <View style={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 }}>
            {locating && <ActivityIndicator color={PALETTE.gold} />}
            <Text style={{ color: PALETTE.textMuted, textAlign: "center" }}>
              {locating ? "Recherche de votre position…" : locationError ?? "Votre position est nécessaire pour voir les salons autour de vous."}
            </Text>
          </View>
        ) : Platform.OS === "web" ? (
          // On web, render the leaflet HTML inside an iframe (WebView is limited)
          // @ts-ignore — react-native-web renders div for View; we use raw iframe
          <iframe
            ref={iframeRef}
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
        backgroundColor: PALETTE.bg, maxHeight: 250,
        paddingBottom: Platform.OS === "web" ? 34 : Math.max(insets.bottom, 10),
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {loading || locating
              ? (t.loading ?? "Chargement…")
              : isError ? "Chargement impossible"
              : !center && !showAll ? "Localisation nécessaire"
              : `${withDistance.length} ${withDistance.length > 1 ? (t.salonsFound ?? "salons trouvés") : (t.salonFound ?? "salon trouvé")}`}
          </Text>
          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {showAll ? "Tous" : `${radius} km`}
          </Text>
        </View>
        {!!locationError && !!center && <Text style={{ color: PALETTE.textMuted }}>{locationError}</Text>}
        {permission && !permission.granted && !permission.canAskAgain && Platform.OS !== "web" && (
          <Pressable testID="map-location-settings" onPress={() => { void Linking.openSettings().catch(() => setLocationError("Ouvrez les réglages de votre téléphone pour autoriser la localisation.")); }}>
            <Text style={{ color: PALETTE.gold, paddingVertical: 8 }}>Autoriser la localisation dans les réglages</Text>
          </Pressable>
        )}
        {isError && <Pressable testID="map-retry-salons" onPress={() => { void refetch(); }}><Text style={{ color: PALETTE.textMuted }}>Impossible de charger tous les salons. Vérifiez votre connexion et réessayez.</Text></Pressable>}
        {!loading && !isError && missingPositions > 0 && <Text style={{ color: PALETTE.textMuted, fontSize: 11, marginBottom: 8 }}>
          {missingPositions} {missingPositions > 1 ? "salons n’ont" : "salon n’a"} pas de position enregistrée et {missingPositions > 1 ? "ne sont" : "n’est"} pas {missingPositions > 1 ? "affichés" : "affiché"} sur la carte.
        </Text>}
        <FlatList
          data={withDistance}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={
            !loading && !locating && !isError && (center || showAll) ? (
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {showAll ? "Aucun salon avec une position enregistrée." : (t.noSalonsInRadius ?? "Aucun salon dans ce rayon. Élargissez la zone.")}
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
                    {item._km === null ? "Position du salon" : `${item._km.toFixed(1)} km`}
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
