import { Feather } from "@expo/vector-icons";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_400Regular_Italic,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getListBarbersQueryKey, useListBarbers, useListHomeGalleryPhotos, useListPublicArticles, useApprovedSalonCatalog } from "@workspace/api-client-react";
import { coordinates, nearbySalons, newestRegisteredSalons, type Coordinates } from "@/lib/salonSearch";
import { useAuth } from "@clerk/expo";
import { reloadAppAsync } from "expo";
import * as Location from "expo-location";
import { Redirect, useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import colors from "@/constants/colors";
import { useAuthedFetch } from "@/lib/api";
import { useBrowsing } from "@/lib/browseIntent";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ShimmerImage } from "@/components/ShimmerImage";
import { GalleryLightbox, LightboxItem } from "@/components/GalleryLightbox";
import { ONBOARDING_KEY } from "./onboarding";
import { salonImageSource } from "@/lib/salonDiscovery";

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

type GalleryItem = { key: string; uri: string | null; src?: any; label: string };

const ITEM_W = 154;
const ITEM_GAP = 10;
const ITEM_STRIDE = ITEM_W + ITEM_GAP;

const MS_PER_PX = 42;

function InfiniteGalleryCarousel({
  items,
  onPressItem,
  serifItalic,
  palette,
}: {
  items: GalleryItem[];
  onPressItem: (item: GalleryItem, allItems: GalleryItem[]) => void;
  serifItalic: string;
  palette: { border: string };
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentX = useRef(0);
  const runRef = useRef<(() => void) | undefined>(undefined);
  const looped = useMemo(() => [...items, ...items, ...items], [items]);
  const totalWidth = ITEM_STRIDE * items.length;

  useEffect(() => {
    const listenerId = translateX.addListener(({ value }) => { currentX.current = value; });

    const run = () => {
      translateX.setValue(0);
      currentX.current = 0;
      animRef.current = Animated.timing(translateX, {
        toValue: -totalWidth,
        duration: totalWidth * MS_PER_PX,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animRef.current.start(({ finished }) => { if (finished) run(); });
    };

    runRef.current = run;
    run();

    return () => {
      translateX.removeListener(listenerId);
      animRef.current?.stop();
    };
  }, [totalWidth]);

  const handleTouchStart = () => {
    animRef.current?.stop();
  };

  const handleTouchEnd = () => {
    const x = currentX.current;
    const remaining = -totalWidth - x;
    if (remaining >= 0) { runRef.current?.(); return; }
    animRef.current = Animated.timing(translateX, {
      toValue: -totalWidth,
      duration: Math.abs(remaining) * MS_PER_PX,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => { if (finished) runRef.current?.(); });
  };

  return (
    <View style={{ overflow: "hidden", marginBottom: 36 }}>
      <Animated.View
        style={{ flexDirection: "row", paddingLeft: 20, paddingBottom: 4, transform: [{ translateX }] }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {looped.map((s, i) => (
          <Pressable
            key={`${s.key}-${i}`}
            onPress={() => onPressItem(s, items)}
            style={{ width: ITEM_W, aspectRatio: 3 / 4, marginRight: ITEM_GAP, borderWidth: 1, borderColor: palette.border, overflow: "hidden" }}
          >
            <ShimmerImage
              source={s.uri ? { uri: s.uri } : s.src}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" }} />
            {s.label ? (
              <Text style={{ position: "absolute", bottom: 10, left: 12, color: "#fff", fontFamily: serifItalic, fontSize: 13 }}>
                {s.label}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

export default function PublicHome() {
  const router = useRouter();
  const pathname = usePathname();
  const { browse } = useLocalSearchParams<{ browse?: string }>();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  const { ready, syncing, user, role, lang, syncAuth, themePref } = useApp();
  const systemScheme = useColorScheme();
  const effective = themePref === "system" ? (systemScheme ?? "dark") : themePref;
  const tp = effective === "dark" ? colors.dark : colors.light;
  const PALETTE = {
    bg: tp.background,
    surface: tp.card,
    surfaceAlt: tp.secondary,
    border: tp.border,
    text: tp.foreground,
    textMuted: tp.mutedForeground,
    textDim: tp.mutedForeground,
    gold: tp.primary,
  };
  const buttonBorder = effective === "dark" ? PALETTE.border : "#000";
  const fetcher = useAuthedFetch();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // Reactive: a barber/admin who tapped "Accueil"/home reaches the public home
  // instead of being redirected to /(barber). Reactive (not mount-once) because
  // expo-router may reuse this screen instance instead of remounting it.
  const browsing = useBrowsing();
  const [locationRefreshing, setLocationRefreshing] = useState(false);
  const [nearbyPosition, setNearbyPosition] = useState<Coordinates | null>(null);
  const [nearbyLocationBusy, setNearbyLocationBusy] = useState(false);
  const [nearbyLocationError, setNearbyLocationError] = useState("");
  const locationPrompted = useRef(false);
  const locationReadLock = useRef(false);
  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const featuredYRef = useRef(0);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const forceBrowse = pathname === "/browse" || browse === "1" || browsing;
  const canUsePublicHome = isLoaded && (!isSignedIn || (!!user && ready && (role === "client" || forceBrowse)));

  const { data, isLoading, isFetching, isError, refetch, isRefetching } = useListBarbers(
    { status: "approved", search: search || undefined, limit: 20 },
    { query: { queryKey: getListBarbersQueryKey({ status: "approved", search: search || undefined, limit: 20 }), staleTime: 30000, refetchOnMount: "always" } },
  );
  const { data: catalog, isLoading: newestLoading, isError: newestError, refetch: refetchNewest } = useApprovedSalonCatalog();
  const newest = useMemo(() => ({ data: newestRegisteredSalons(catalog) }), [catalog]);
  const nearestSalons = useMemo(
    () => nearbyPosition ? nearbySalons(catalog ?? [], nearbyPosition, null).slice(0, 20) : [],
    [catalog, nearbyPosition],
  );
  const locateNearbySalons = async () => {
    if (locationReadLock.current) return;
    locationReadLock.current = true;
    setNearbyLocationBusy(true);
    setNearbyLocationError("");
    try {
      const permission = locationPermission?.granted ? locationPermission : await requestLocationPermission();
      if (!permission.granted) {
        setNearbyPosition(null);
        setNearbyLocationError(lang === "fr"
          ? "Autorisez la localisation pour afficher les salons proches."
          : "Allow location access to see nearby salons.");
        return;
      }
      const { coords: point } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const position = coordinates(point.latitude, point.longitude);
      if (!position) throw new Error("Invalid device location");
      setNearbyPosition(position);
    } catch {
      setNearbyPosition(null);
      setNearbyLocationError(lang === "fr"
        ? "Votre position n’a pas pu être récupérée. Réessayez."
        : "We couldn't get your location. Try again.");
    } finally {
      setNearbyLocationBusy(false);
      locationReadLock.current = false;
    }
  };
  useEffect(() => {
    if (!onboardingDone || !canUsePublicHome || !locationPermission || locationPrompted.current) return;
    locationPrompted.current = true;
    void locateNearbySalons();
  }, [onboardingDone, canUsePublicHome, locationPermission]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useFocusEffect(React.useCallback(() => {
    void refetch(); void refetchNewest();
  }, [refetch, refetchNewest]));
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

  useEffect(() => {
    if (isLoaded) {
      setAuthWaitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setAuthWaitTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  const list = data?.data ?? [];
  const searching = isLoading || (query.trim() !== search) || (!!query.trim() && isFetching);

  // While onboarding state unknown, or signed-in user still syncing — show spinner.
  // Do NOT gate on !isLoaded: the home screen is public and must show immediately
  // even if the Clerk proxy is slow. Auth state catches up in the background.
  if (onboardingDone === null || (isSignedIn && (!ready || (syncing && !user)))) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={PALETTE.gold} />
      </View>
    );
  }

  // First-time user: show onboarding
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  // Signed-in barber/admin → dashboard, UNLESS they explicitly chose to browse
  // the public home from their profile (?browse=1).
  // A barber/admin reaches the public home either via the dedicated "/browse"
  // route (unambiguous, unlike "/") or via the browse intent flag/param.
  if (isSignedIn && user && (role === "barber" || role === "admin") && !forceBrowse) {
    return <Redirect href="/(barber)" />;
  }

  const featured = query.trim() ? list : list.slice(0, 6);
  const openLocationSettings = () => {
    if (locationPermission && !locationPermission.canAskAgain && Platform.OS !== "web") {
      Alert.alert(
        lang === "fr" ? "Localisation désactivée" : "Location is disabled",
        lang === "fr" ? "Autorisez la localisation dans les réglages pour voir les salons proches." : "Allow location in Settings to see nearby salons.",
        [
          { text: lang === "fr" ? "Annuler" : "Cancel", style: "cancel" },
          { text: lang === "fr" ? "Réglages" : "Settings", onPress: () => { void Linking.openSettings(); } },
        ],
      );
      return;
    }
    void locateNearbySalons();
  };

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
          <Text style={{ color: effective === "dark" ? PALETTE.gold : PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase" }}>
            Zbarber
          </Text>
        </View>

        {!isLoaded && authWaitTimedOut ? (
          <Pressable
            onPress={() => { void reloadAppAsync(); }}
            style={{
              height: 36,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: buttonBorder,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={lang === "fr" ? "Réessayer la connexion" : "Retry connection"}
          >
            <Feather name="refresh-cw" size={13} color={PALETTE.gold} />
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {lang === "fr" ? "Réessayer" : "Retry"}
            </Text>
          </Pressable>
        ) : !isLoaded ? (
          <View
            style={{
              width: 80,
              height: 36,
              alignItems: "flex-end",
              justifyContent: "center",
            }}
            accessibilityLabel={lang === "fr" ? "Vérification de la session" : "Checking session"}
          >
            <ActivityIndicator size="small" color={PALETTE.gold} />
          </View>
        ) : isSignedIn ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={handleRefreshLocation}
              disabled={locationRefreshing}
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: buttonBorder, alignItems: "center", justifyContent: "center" }}
              hitSlop={6}
            >
              {locationRefreshing
                ? <ActivityIndicator size="small" color={PALETTE.gold} />
                : <Feather name="map-pin" size={14} color={PALETTE.gold} />}
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(
                  role === "barber" || role === "admin" ? "/(barber)/profile" : "/(client)/profile",
                )
              }
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: buttonBorder, alignItems: "center", justifyContent: "center" }}
              hitSlop={6}
              accessibilityLabel={lang === "fr" ? "Profil" : "Profile"}
            >
              <Feather name="user" size={14} color={PALETTE.gold} />
            </Pressable>
            {role !== "barber" && role !== "admin" && (
              <Pressable
                onPress={() => router.push("/(client)/bookings")}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: buttonBorder }}
              >
                <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {lang === "fr" ? "Mes réservations" : "My bookings"}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: buttonBorder }}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); void refetchNewest(); }} tintColor={PALETTE.gold} />}
      >
        {/* Hero + search */}
        <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 24 }}>
          <Text style={{ color: PALETTE.text, fontFamily: serifBold, fontSize: 36, lineHeight: 42 }}>
            {isSignedIn && user ? `Bonjour,\n${user.name?.split(" ")[0] ?? "vous"}.` : "Découvrez\nl'excellence."}
          </Text>
          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
            Les meilleurs barbiers, à portée de main.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, paddingHorizontal: 14 }}>
            <Feather name="search" size={16} color={PALETTE.gold} />
            <TextInput
              testID="home-salon-search"
              accessibilityLabel="Rechercher un salon par nom, ville ou quartier"
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
                Le journal Zbarber
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
                      source={{ uri: resolveObjectUrl(a.coverImageUrl, 700) ?? "" }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,0.30)" }} />
                  </View>
                  <Text
                    style={{ color: PALETTE.text, fontFamily: serif, fontSize: 18, lineHeight: 24, marginTop: 12 }}
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

        {!query.trim() && (
          <View testID="new-salons-section" style={{ marginBottom: 28 }}>
            <SectionHeader title={lang === "fr" ? "Nouveaux salons" : "New salons"}
              action="" serifFont={serif} textColor={PALETTE.text} accentColor={PALETTE.gold} />
            {newestLoading ? <ActivityIndicator color={PALETTE.gold} /> : newestError ? (
              <Pressable onPress={() => refetchNewest()} style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: PALETTE.textMuted }}>Impossible de charger les nouveaux salons. Réessayer</Text>
              </Pressable>
            ) : !newest?.data.length ? (
              <Text style={{ paddingHorizontal: 20, color: PALETTE.textMuted }}>Les nouveaux salons validés apparaîtront ici.</Text>
            ) : (
              <ScrollView horizontal testID="new-salons-carousel" showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                {newest.data.map((b, idx) => (
                  <Pressable key={b.id} accessibilityLabel={`Ouvrir ${b.salonName}`}
                    onPress={() => router.push(`/salon/${b.id}` as never)} style={{ width: 190 }}>
                    <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"}
                      source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])}
                      style={{ width: 190, height: 150, borderWidth: 1, borderColor: PALETTE.border }} contentFit="cover" />
                    <Text numberOfLines={1} style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17, marginTop: 8 }}>{b.salonName}</Text>
                    <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontSize: 12, marginTop: 4 }}>{[b.neighborhood, b.city].filter(Boolean).join(" • ")}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {!query.trim() && !!locationPermission && !locationPermission.granted && (
          <View testID="nearby-location-gate" style={{ marginBottom: 28 }}>
            <SectionHeader title={lang === "fr" ? "Salons à proximité" : "Nearby salons"}
              action="" serifFont={serif} textColor={PALETTE.text} accentColor={PALETTE.gold} />
            <View style={{ marginHorizontal: 20, padding: 16, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, gap: 12 }}>
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>
                {nearbyLocationError || (lang === "fr"
                  ? "Autorisez votre position pour découvrir les salons les plus proches de vous."
                  : "Allow location access to discover the closest salons.")}
              </Text>
              <Pressable testID="nearby-location-enable" onPress={openLocationSettings} disabled={nearbyLocationBusy}
                style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, backgroundColor: PALETTE.gold, opacity: nearbyLocationBusy ? 0.6 : 1 }}>
                {nearbyLocationBusy ? <ActivityIndicator color={PALETTE.bg} /> : <Feather name="crosshair" size={16} color={PALETTE.bg} />}
                <Text style={{ color: PALETTE.bg, fontFamily: "Inter_600SemiBold" }}>
                  {nearbyLocationBusy
                    ? (lang === "fr" ? "Recherche de votre position…" : "Finding your location…")
                    : (lang === "fr" ? "Activer ma position" : "Enable my location")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {!query.trim() && !!locationPermission?.granted && (
          <View testID="nearby-salons-section" style={{ marginBottom: 30 }}>
            <SectionHeader title={lang === "fr" ? "Salons à proximité" : "Nearby salons"}
              action={nearbyPosition ? (lang === "fr" ? "Actualiser" : "Refresh") : ""}
              onPressAction={openLocationSettings} serifFont={serif} textColor={PALETTE.text} accentColor={PALETTE.gold} />
            {nearbyLocationBusy || (nearbyPosition && newestLoading) ? (
              <ActivityIndicator color={PALETTE.gold} />
            ) : nearbyLocationError ? (
              <Pressable testID="nearby-location-retry" onPress={openLocationSettings} style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: PALETTE.textMuted }}>{nearbyLocationError} {lang === "fr" ? "Réessayer." : "Try again."}</Text>
              </Pressable>
            ) : newestError ? (
              <Pressable onPress={() => { void refetchNewest(); }} style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: PALETTE.textMuted }}>{lang === "fr" ? "Impossible de charger les salons proches. Réessayer." : "Nearby salons couldn't be loaded. Try again."}</Text>
              </Pressable>
            ) : !nearbyPosition ? (
              <Pressable onPress={openLocationSettings} style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: PALETTE.textMuted }}>{lang === "fr" ? "Activez votre position pour voir les salons proches." : "Enable location to see nearby salons."}</Text>
              </Pressable>
            ) : nearestSalons.length === 0 ? (
              <Text style={{ paddingHorizontal: 20, color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 14 }}>
                {lang === "fr" ? "Aucun salon avec une position enregistrée pour le moment." : "No salons with a saved location yet."}
              </Text>
            ) : (
              <ScrollView horizontal testID="nearby-salons-carousel" showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}>
                {nearestSalons.map((b, idx) => {
                  if (b._km == null) return null;
                  const distanceLabel = b._km < 1 ? `${Math.round(b._km * 1000)} m` : `${b._km.toFixed(1)} km`;
                  return (
                    <Pressable key={b.id} testID={`nearby-salon-${b.id}`} accessibilityRole="button"
                      accessibilityLabel={`${b.salonName}, ${distanceLabel}`}
                      onPress={() => router.push(`/salon/${b.id}` as never)} style={{ width: 210 }}>
                      <View style={{ width: "100%", height: 138, borderWidth: 1, borderColor: PALETTE.border, overflow: "hidden" }}>
                        <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"}
                          source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])}
                          style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        <View style={{ position: "absolute", top: 9, right: 9, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: PALETTE.bg }}>
                          <Feather name="navigation" size={12} color={PALETTE.gold} />
                          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 11 }}>{distanceLabel}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17, marginTop: 9 }}>
                        {b.salonName}
                      </Text>
                      <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 }}>
                        {[b.neighborhood, b.city].filter(Boolean).join(" • ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Featured salons / server-side search results */}
        <View onLayout={(e) => { featuredYRef.current = e.nativeEvent.layout.y; }}>
        <SectionHeader
          title={query.trim() ? `${data?.total ?? 0} résultat${data?.total !== 1 ? "s" : ""}` : "Salons en Vedette"}
          action={query ? "" : "Tout voir"}
          serifFont={serif}
          onPressAction={() => router.push("/salons" as never)}
          textColor={PALETTE.text}
          accentColor={PALETTE.gold}
        />
        </View>
        {searching ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        ) : isError ? (
          <Pressable onPress={() => refetch()} style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <Text style={{ color: PALETTE.textMuted }}>Impossible de charger les salons. Réessayer</Text>
          </Pressable>
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
                  <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"} source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])} style={{ width: "100%", height: "100%" }} contentFit="cover" />
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
                <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 18, marginBottom: 4 }} numberOfLines={1}>{b.salonName}</Text>
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

        {!!query.trim() && !searching && !isError && (data?.total ?? 0) > list.length && (
          <Pressable onPress={() => router.push({ pathname: "/salons", params: { search: query.trim() } })}
            style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Text style={{ color: PALETTE.gold }}>Voir tous les {data?.total} résultats →</Text>
          </Pressable>
        )}

        {/* Style inspiration */}
        {!query && (
          <>
            <SectionHeader
              title="L'Inspiration"
              action="Galerie"
              serifFont={serif}
              onPressAction={() => router.push("/gallery")}
              textColor={PALETTE.text}
              accentColor={PALETTE.gold}
            />
            <InfiniteGalleryCarousel
              items={
                homeGallery && homeGallery.length > 0
                  ? homeGallery.slice(0, 8).map((p) => ({
                      key: `db-${p.id}`,
                      uri: resolveObjectUrl(p.imageUrl, 900),
                      label: p.caption ?? "",
                    }))
                  : styleImages.map((s) => ({ key: s.label, src: s.src as any, uri: null as string | null, label: s.label }))
              }
              onPressItem={(s, allItems) => {
                const idx = allItems.findIndex((it) => it.key === s.key);
                const lbItems: LightboxItem[] = allItems.map((it) => ({ uri: it.uri, src: it.src, label: it.label }));
                setLightbox({ items: lbItems, index: Math.max(0, idx) });
              }}
              serifItalic={serifItalic}
              palette={PALETTE}
            />

            {/* Barber CTA */}
            {!isSignedIn && (
              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <View style={{ borderWidth: 1, borderColor: `${PALETTE.gold}40`, backgroundColor: PALETTE.surface, padding: 22, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${PALETTE.gold}15`, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="scissors" size={22} color={PALETTE.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17, marginBottom: 4 }}>Vous êtes barbier ?</Text>
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

      <GalleryLightbox
        items={lightbox?.items ?? []}
        initialIndex={lightbox?.index ?? 0}
        visible={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </View>
  );
}

function SectionHeader({ title, action, serifFont, onPressAction, textColor, accentColor }: { title: string; action: string; serifFont: string; onPressAction?: () => void; textColor: string; accentColor: string }) {
  return (
    <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <Text style={{ color: textColor, fontFamily: serifFont, fontSize: 22 }}>{title}</Text>
      {action ? (
        <Pressable onPress={onPressAction} hitSlop={8}>
          <Text style={{ color: accentColor, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
