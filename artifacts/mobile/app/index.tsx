import { Feather } from "@expo/vector-icons";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_400Regular_Italic,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useListBarbers, useListHomeGalleryPhotos, useListPublicArticles } from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ONBOARDING_KEY } from "./onboarding";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  surfaceAlt: "#1A1A1A",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const heroImage = require("../assets/images/client-home/hero.png");
const salonFallbacks: ImageSourcePropType[] = [
  require("../assets/images/client-home/salon1.png"),
  require("../assets/images/client-home/salon2.png"),
  require("../assets/images/client-home/salon3.png"),
];
const styleImages = [
  { src: require("../assets/images/client-home/style1.png"), label: "Le Dégradé" },
  { src: require("../assets/images/client-home/style2.png"), label: "La Barbe" },
  { src: require("../assets/images/client-home/style3.png"), label: "Le Taper" },
  { src: require("../assets/images/client-home/style4.png"), label: "Classique" },
];

export default function PublicHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  const { ready, syncing, user, role, lang, syncAuth } = useApp();
  const fetcher = useAuthedFetch();
  const [query, setQuery] = useState("");
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [locationRefreshing, setLocationRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const featuredYRef = useRef(0);
  const [lightbox, setLightbox] = useState<{ uri: string | null; src?: any; label?: string } | null>(null);

  const { data, isLoading, refetch, isRefetching } = useListBarbers({ status: "approved" });
  const { data: homeGallery } = useListHomeGalleryPhotos();
  const { data: articles } = useListPublicArticles();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
  });

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => setOnboardingDone(!!val));
  }, []);

  const list = useMemo(() => {
    const items = data?.data ?? [];
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (b) =>
        b.salonName.toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q) ||
        (b.neighborhood ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  // While Clerk or AppContext loads, or onboarding state unknown — show spinner
  if (!isLoaded || onboardingDone === null || (!isSignedIn ? false : !ready || (syncing && !user))) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={PALETTE.gold} />
      </View>
    );
  }

  // First-time user: show onboarding
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  // Signed-in barber/admin → dashboard
  if (isSignedIn && user && (role === "barber" || role === "admin")) {
    return <Redirect href="/(barber)" />;
  }

  const featured = list.slice(0, 6);
  const nearby = list.slice(0, 4);

  const handleRefreshLocation = async () => {
    if (!isSignedIn) {
      Alert.alert("Connexion requise", "Connectez-vous pour partager votre position.", [
        { text: "Annuler", style: "cancel" },
        { text: "Se connecter", onPress: () => router.push("/(auth)/sign-in") },
      ]);
      return;
    }
    setLocationRefreshing(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission refusée", "Autorisez la géolocalisation dans vos réglages.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetcher("/api/users/me/location", {
        method: "POST",
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      await syncAuth();
      Alert.alert("Position mise à jour", "Vos suggestions seront affinées.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'actualiser la position.");
    } finally {
      setLocationRefreshing(false);
    }
  };
  const serif = fontsLoaded ? "PlayfairDisplay_500Medium" : "Inter_700Bold";
  const serifBold = fontsLoaded ? "PlayfairDisplay_600SemiBold" : "Inter_700Bold";
  const serifItalic = fontsLoaded ? "PlayfairDisplay_400Regular_Italic" : "Inter_400Regular";

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      {/* Top bar */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12,
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        backgroundColor: PALETTE.bg,
      }}>
        <View>
          <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase" }}>
            Global Barber
          </Text>
          <Text style={{ color: PALETTE.textDim, fontFamily: "Inter_400Regular", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
            Corp.
          </Text>
        </View>

        {isSignedIn && user ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={handleRefreshLocation}
              disabled={locationRefreshing}
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: PALETTE.border, alignItems: "center", justifyContent: "center" }}
              hitSlop={6}
            >
              {locationRefreshing
                ? <ActivityIndicator size="small" color={PALETTE.gold} />
                : <Feather name="map-pin" size={14} color={PALETTE.gold} />}
            </Pressable>
            <Pressable
              onPress={() => router.push("/(client)/bookings")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: PALETTE.border }}
            >
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {lang === "fr" ? "Mes réservations" : "My bookings"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: PALETTE.border }}
            >
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Connexion</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/sign-up")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: PALETTE.gold }}
            >
              <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 12 }}>Inscription</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PALETTE.gold} />}
      >
        {/* Hero + search */}
        <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 24 }}>
          <Text style={{ color: "#fff", fontFamily: serifBold, fontSize: 36, lineHeight: 42 }}>
            {isSignedIn && user ? `Bonjour,\n${user.name?.split(" ")[0] ?? "vous"}.` : "Découvrez\nl'excellence."}
          </Text>
          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
            Les meilleurs barbiers, à portée de main.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, paddingHorizontal: 14 }}>
            <Feather name="search" size={16} color={PALETTE.gold} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Salon, ville, quartier..."
              placeholderTextColor={PALETTE.textDim}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 13 }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Feather name="x" size={14} color={PALETTE.textMuted} />
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push("/map" as never)}
              hitSlop={10}
              style={{ marginLeft: 8, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: PALETTE.border, flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Feather name="map" size={14} color={PALETTE.gold} />
              <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                {lang === "fr" ? "Carte" : "Map"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Hero image — falls back to a static visual when no articles are configured */}
        {!query && (!articles || articles.length === 0) && (
          <View style={{ paddingHorizontal: 20, marginBottom: 36 }}>
            <ImageBackground source={heroImage} style={{ width: "100%", aspectRatio: 16 / 9, justifyContent: "flex-end" }}>
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,0.50)" }} />
              <View style={{ padding: 16 }}>
                <View style={{ alignSelf: "flex-start", backgroundColor: PALETTE.gold, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 }}>
                  <Text style={{ color: "#000", fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>L'Édito</Text>
                </View>
                <Text style={{ color: "#fff", fontFamily: serif, fontSize: 22, lineHeight: 28 }}>La Renaissance du Rasage</Text>
              </View>
            </ImageBackground>
          </View>
        )}

        {/* Articles carousel (édito) */}
        {!query && articles && articles.length > 0 && (
          <View style={{ marginBottom: 36 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: PALETTE.gold, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#000", fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>L'Édito</Text>
              </View>
              <Text style={{ color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 13 }}>
                Le journal Global Barber
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
              snapToInterval={296}
              decelerationRate="fast"
            >
              {articles.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/articles/${a.id}` as never)}
                  style={{ width: 282 }}
                >
                  <View style={{ aspectRatio: 4 / 3, borderWidth: 1, borderColor: PALETTE.border, overflow: "hidden" }}>
                    <Image
                      source={{ uri: resolveObjectUrl(a.coverImageUrl) ?? "" }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,0.30)" }} />
                  </View>
                  <Text
                    style={{ color: "#fff", fontFamily: serif, fontSize: 18, lineHeight: 24, marginTop: 12 }}
                    numberOfLines={2}
                  >
                    {a.title}
                  </Text>
                  {a.subtitle ? (
                    <Text
                      style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 4 }}
                      numberOfLines={2}
                    >
                      {a.subtitle}
                    </Text>
                  ) : null}
                  <Text style={{ color: PALETTE.gold, fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_700Bold", textTransform: "uppercase", marginTop: 8 }}>
                    Lire l'article →
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured salons */}
        <View onLayout={(e) => { featuredYRef.current = e.nativeEvent.layout.y; }}>
        <SectionHeader
          title={query ? `${list.length} résultat${list.length !== 1 ? "s" : ""}` : "Salons en Vedette"}
          action={query ? "" : "Tout voir"}
          serifFont={serif}
          onPressAction={() => router.push("/salons" as never)}
        />
        </View>
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        ) : featured.length === 0 ? (
          <Text style={{ paddingHorizontal: 20, color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 14, marginBottom: 32 }}>
            {query ? "Aucun salon ne correspond." : "Bientôt — nos premiers salons partenaires."}
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 16 }}
            style={{ marginBottom: 36 }}
          >
            {featured.map((b, idx) => (
              <Pressable key={b.id} onPress={() => router.push(`/salon/${b.id}` as never)} style={{ width: 240 }}>
                <View style={{ aspectRatio: 3 / 4, borderWidth: 1, borderColor: PALETTE.border, marginBottom: 12, overflow: "hidden" }}>
                  <Image source={salonFallbacks[idx % salonFallbacks.length]} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  {b.rating && Number(b.rating) > 0 ? (
                    <View style={{ position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Feather name="star" size={11} color={PALETTE.gold} />
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>{Number(b.rating).toFixed(1)}</Text>
                    </View>
                  ) : (
                    <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: PALETTE.gold, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Nouveau</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: "#fff", fontFamily: serif, fontSize: 18, marginBottom: 4 }} numberOfLines={1}>{b.salonName}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="map-pin" size={10} color={PALETTE.textMuted} />
                  <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }} numberOfLines={1}>
                    {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Style inspiration */}
        {!query && (
          <>
            <SectionHeader
              title="L'Inspiration"
              action="Galerie"
              serifFont={serif}
              onPressAction={() => router.push("/gallery")}
            />
            <View style={{ paddingHorizontal: 20, marginBottom: 36 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {(homeGallery && homeGallery.length > 0
                  ? homeGallery.slice(0, 4).map((p) => ({
                      key: `db-${p.id}`,
                      uri: resolveObjectUrl(p.imageUrl),
                      label: p.caption ?? "",
                    }))
                  : styleImages.map((s) => ({ key: s.label, src: s.src as any, uri: null as string | null, label: s.label }))
                ).map((s: any) => (
                  <Pressable key={s.key} onPress={() => setLightbox({ uri: s.uri, src: s.src, label: s.label })} style={{ width: "48%", aspectRatio: 1, borderWidth: 1, borderColor: PALETTE.border, overflow: "hidden" }}>
                    <Image source={s.uri ? { uri: s.uri } : s.src} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" }} />
                    {s.label ? <Text style={{ position: "absolute", bottom: 10, left: 12, color: "#fff", fontFamily: serifItalic, fontSize: 13 }}>{s.label}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Nearby list */}
            {nearby.length > 0 && (
              <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
                <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 22, marginBottom: 16 }}>Près de chez vous</Text>
                <View style={{ gap: 12 }}>
                  {nearby.map((b, idx) => (
                    <Pressable
                      key={`near-${b.id}`}
                      onPress={() => router.push(`/salon/${b.id}` as never)}
                      style={{ flexDirection: "row", gap: 14, padding: 14, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, alignItems: "center" }}
                    >
                      <Image source={salonFallbacks[idx % salonFallbacks.length]} style={{ width: 72, height: 72 }} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fff", fontFamily: serif, fontSize: 16, marginBottom: 4 }} numberOfLines={1}>{b.salonName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                          <Feather name="map-pin" size={10} color={PALETTE.textMuted} />
                          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }} numberOfLines={1}>
                            {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                          </Text>
                        </View>
                        {b.rating && Number(b.rating) > 0 ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="star" size={10} color={PALETTE.gold} />
                            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{Number(b.rating).toFixed(1)}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Nouveau</Text>
                        )}
                      </View>
                      <View style={{ width: 36, height: 36, borderWidth: 1, borderColor: PALETTE.gold, alignItems: "center", justifyContent: "center" }}>
                        <Feather name="chevron-right" size={16} color={PALETTE.gold} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Barber CTA */}
            {!isSignedIn && (
              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <View style={{ borderWidth: 1, borderColor: `${PALETTE.gold}40`, backgroundColor: PALETTE.surface, padding: 22, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${PALETTE.gold}15`, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="scissors" size={22} color={PALETTE.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontFamily: serif, fontSize: 17, marginBottom: 4 }}>Vous êtes barbier ?</Text>
                    <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
                      Publiez votre salon, gérez vos rdv.
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push("/(auth)/sign-up")} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: PALETTE.gold }}>
                    <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 12 }}>Démarrer</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable onPress={() => setLightbox(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
          <Pressable
            onPress={() => setLightbox(null)}
            hitSlop={12}
            style={{ position: "absolute", top: insets.top + 12, right: 20, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          {lightbox && (
            <Image
              source={lightbox.uri ? { uri: lightbox.uri } : lightbox.src}
              style={{ width: "92%", height: "70%" }}
              resizeMode="contain"
            />
          )}
          {lightbox?.label ? (
            <Text style={{ marginTop: 18, color: "#fff", fontFamily: serifItalic, fontSize: 16 }}>{lightbox.label}</Text>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionHeader({ title, action, serifFont, onPressAction }: { title: string; action: string; serifFont: string; onPressAction?: () => void }) {
  return (
    <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <Text style={{ color: PALETTE.text, fontFamily: serifFont, fontSize: 22 }}>{title}</Text>
      {action ? (
        <Pressable onPress={onPressAction} hitSlop={8}>
          <Text style={{ color: PALETTE.gold, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
