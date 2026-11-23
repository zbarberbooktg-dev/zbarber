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
  useWindowDimensions,
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
import { SalonAdsCarousel } from "@/components/SalonAdsCarousel";
import { SalonListRow } from "@/components/SalonListRow";
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
  palette: { text: string };
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
            style={{ width: ITEM_W, marginRight: ITEM_GAP }}
          >
            <ShimmerImage
              source={s.uri ? { uri: s.uri } : s.src}
              style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 16, overflow: "hidden" }}
              contentFit="cover"
            />
            {s.label ? (
              <Text style={{ marginTop: 7, color: palette.text, fontFamily: serifItalic, fontSize: 13 }}>
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
  const fr = lang === "fr";
  const { width } = useWindowDimensions();
  const editorialWidth = Math.min(480, width - 58);
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
    onGold: colors.dark.primaryForeground,
  };
  const buttonBorder = PALETTE.border;
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
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const adViewport = useRef({ offset: 0, viewport: 0, top: 0, height: 0, visible: false });
  const [adsVisible, setAdsVisible] = useState(false);
  const updateAdVisibility = () => {
    const frame = adViewport.current;
    const intersection = Math.min(frame.offset + frame.viewport, frame.top + frame.height) - Math.max(frame.offset, frame.top);
    const visible = frame.height > 0 && intersection >= frame.height * 0.6;
    if (visible !== frame.visible) { frame.visible = visible; setAdsVisible(visible); }
  };
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
      Alert.alert(fr ? "Connexion requise" : "Sign-in required", fr ? "Connectez-vous pour partager votre position." : "Sign in to share your location.", [
        { text: fr ? "Annuler" : "Cancel", style: "cancel" },
        { text: fr ? "Se connecter" : "Sign in", onPress: () => router.push("/(auth)/sign-in") },
      ]);
      return;
    }
    setLocationRefreshing(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(fr ? "Permission refusée" : "Permission denied", fr ? "Autorisez la géolocalisation dans vos réglages." : "Allow location access in Settings.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetcher("/api/users/me/location", {
        method: "POST",
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      await syncAuth();
      Alert.alert(fr ? "Position mise à jour" : "Location updated", fr ? "Vos suggestions seront affinées." : "This helps us improve your suggestions.");
    } catch (e: any) {
      Alert.alert(fr ? "Erreur" : "Error", e?.message ?? (fr ? "Impossible d’actualiser la position." : "Unable to update your location."));
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }}>
          <Feather name="scissors" size={17} color={PALETTE.gold} />
          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: 0.5 }} numberOfLines={1}>
            Zbarber
          </Text>
        </View>

        {!isLoaded && authWaitTimedOut ? (
          <Pressable
            onPress={() => { void reloadAppAsync(); }}
            style={{
              minHeight: 44,
              borderRadius: 22,
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
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={fr ? "Actualiser votre position" : "Refresh your location"}
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
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={lang === "fr" ? "Profil" : "Profile"}
            >
              <Feather name="user" size={14} color={PALETTE.gold} />
            </Pressable>
            {role !== "barber" && role !== "admin" && (
              <Pressable
                onPress={() => router.push("/(client)/bookings")}
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: buttonBorder, backgroundColor: PALETTE.surface }}
                accessibilityRole="button"
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
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: buttonBorder, backgroundColor: PALETTE.surface }}
              accessibilityRole="button"
            >
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{fr ? "Connexion" : "Sign in"}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/sign-up")}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, backgroundColor: PALETTE.gold }}
              accessibilityRole="button"
            >
              <Text style={{ color: PALETTE.onGold, fontFamily: "Inter_700Bold", fontSize: 12 }}>{fr ? "Inscription" : "Sign up"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        onLayout={(e) => { adViewport.current.viewport = e.nativeEvent.layout.height; updateAdVisibility(); }}
        onScroll={(e) => { adViewport.current.offset = e.nativeEvent.contentOffset.y; updateAdVisibility(); }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); void refetchNewest(); }} tintColor={PALETTE.gold} />}
      >
        {/* Hero + search */}
        <View style={{ paddingHorizontal: 20, marginTop: 10, marginBottom: 22 }}>
          <Text accessibilityRole="header" style={{ color: PALETTE.text, fontFamily: serifBold, fontSize: 33, lineHeight: 40 }}>
            {isSignedIn && user
              ? `${fr ? "Bonjour" : "Hello"}, ${user.name?.trim().split(/\s+/)[0] || (fr ? "à vous" : "there")}.`
              : (fr ? "Trouvez votre barbier." : "Find your barber.")}
          </Text>
          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
            {fr ? "Découvrez les salons et réservez votre prochaine coupe." : "Discover salons and book your next cut."}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", minHeight: 56, borderRadius: 18, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, paddingLeft: 14, paddingRight: 6 }}>
            <Feather name="search" size={19} color={PALETTE.gold} />
            <TextInput
              testID="home-salon-search"
              accessibilityLabel={fr ? "Rechercher un salon par nom, ville ou quartier" : "Search salons by name, city or neighborhood"}
              value={query}
              onChangeText={setQuery}
              placeholder={fr ? "Salon, ville, quartier…" : "Salon, city, neighborhood…"}
              placeholderTextColor={PALETTE.textDim}
              style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10, color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 14 }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={fr ? "Effacer la recherche" : "Clear search"}
                style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Feather name="x" size={14} color={PALETTE.textMuted} />
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push("/map" as never)}
              accessibilityRole="button"
              style={{ minHeight: 44, paddingHorizontal: 9, borderRadius: 13, backgroundColor: PALETTE.surfaceAlt, flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Feather name="map" size={14} color={PALETTE.gold} />
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {lang === "fr" ? "Carte" : "Map"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Hero image — falls back to a static visual when no articles are configured */}
        {!query && (!articles || articles.length === 0) && (
          <View style={{ paddingHorizontal: 20, marginBottom: 36 }}>
            <ImageBackground source={heroImage} style={{ width: "100%", aspectRatio: 16 / 10, maxHeight: 330, borderRadius: 22, overflow: "hidden" }}>
              <View style={{ padding: 13 }}>
                <View style={{ alignSelf: "flex-start", backgroundColor: PALETTE.gold, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8, borderRadius: 12 }}>
                  <Text style={{ color: PALETTE.onGold, fontSize: 10, letterSpacing: 1.2, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>{fr ? "L’Édito" : "Editorial"}</Text>
                </View>
              </View>
            </ImageBackground>
            <Text style={{ color: PALETTE.text, marginTop: 8, fontFamily: serif, fontSize: 25, lineHeight: 32 }}>{fr ? "La renaissance du rasage" : "The revival of shaving"}</Text>
          </View>
        )}

        {/* Articles carousel (édito) */}
        {!query && articles && articles.length > 0 && (
          <View style={{ marginBottom: 36 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: PALETTE.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: PALETTE.onGold, fontSize: 10, letterSpacing: 1.2, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>{fr ? "L’Édito" : "Editorial"}</Text>
              </View>
              <Text style={{ color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 13 }}>
                {fr ? "Le journal Zbarber" : "The Zbarber journal"}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
              snapToInterval={editorialWidth + 14}
              decelerationRate="fast"
            >
              {articles.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/articles/${a.id}` as never)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ width: editorialWidth, opacity: pressed ? 0.85 : 1 })}
                >
                  <View style={{ aspectRatio: 16 / 10, borderRadius: 22, overflow: "hidden" }}>
                    <Image
                      source={{ uri: resolveObjectUrl(a.coverImageUrl, 700) ?? "" }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                  <View style={homeStyles.salonDetails}>
                  <Text
                    style={{ color: PALETTE.text, fontFamily: serif, fontSize: 21, lineHeight: 27 }}
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
                  <Text style={{ color: PALETTE.text, fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 10 }}>
                    {fr ? "Lire l’article →" : "Read the article →"}
                  </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {!query.trim() && <SalonAdsCarousel visible={adsVisible} onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          Object.assign(adViewport.current, { top: y, height });
          updateAdVisibility();
        }} />}

        {!query.trim() && (
          <View testID="new-salons-section" style={{ marginBottom: 28 }}>
            <SectionHeader title={lang === "fr" ? "Nouveaux salons" : "New salons"}
              action="" serifFont={serif} textColor={PALETTE.text} accentColor={PALETTE.gold} />
            {newestLoading ? <ActivityIndicator color={PALETTE.gold} /> : newestError ? (
              <Pressable onPress={() => refetchNewest()} style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: PALETTE.textMuted }}>{fr ? "Impossible de charger les nouveaux salons. Réessayer." : "New salons couldn’t be loaded. Try again."}</Text>
              </Pressable>
            ) : !newest?.data.length ? (
              <Text style={{ paddingHorizontal: 20, color: PALETTE.textMuted }}>{fr ? "Les nouveaux salons validés apparaîtront ici." : "Newly approved salons will appear here."}</Text>
            ) : (
              <ScrollView horizontal testID="new-salons-carousel" showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                {newest.data.map((b, idx) => (
                  <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={fr ? `Ouvrir ${b.salonName}` : `Open ${b.salonName}`}
                    onPress={() => router.push(`/salon/${b.id}` as never)} style={({ pressed }) => ({ width: 190, opacity: pressed ? 0.85 : 1 })}>
                    <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"}
                      source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])}
                      style={{ width: "100%", height: 135, borderRadius: 18, overflow: "hidden" }} contentFit="cover" />
                    <View style={homeStyles.salonDetails}>
                      <Text numberOfLines={1} style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17 }}>{b.salonName}</Text>
                      <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontSize: 12, marginTop: 4 }}>{[b.neighborhood, b.city].filter(Boolean).join(" • ")}</Text>
                    </View>
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
            <View style={{ marginHorizontal: 20, padding: 16, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 18, gap: 12 }}>
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>
                {nearbyLocationError || (lang === "fr"
                  ? "Autorisez votre position pour découvrir les salons les plus proches de vous."
                  : "Allow location access to discover the closest salons.")}
              </Text>
              <Pressable testID="nearby-location-enable" onPress={openLocationSettings} disabled={nearbyLocationBusy}
                accessibilityRole="button"
                style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: PALETTE.gold, opacity: nearbyLocationBusy ? 0.6 : 1 }}>
                {nearbyLocationBusy ? <ActivityIndicator color={PALETTE.onGold} /> : <Feather name="crosshair" size={16} color={PALETTE.onGold} />}
                <Text style={{ color: PALETTE.onGold, fontFamily: "Inter_600SemiBold" }}>
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
                      onPress={() => router.push(`/salon/${b.id}` as never)} style={({ pressed }) => ({ width: 210, opacity: pressed ? 0.85 : 1 })}>
                      <View style={{ width: "100%", height: 138, borderRadius: 18, overflow: "hidden" }}>
                        <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"}
                          source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])}
                          style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        <View style={{ position: "absolute", top: 9, right: 9, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: PALETTE.bg }}>
                          <Feather name="navigation" size={12} color={PALETTE.gold} />
                          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 11 }}>{distanceLabel}</Text>
                        </View>
                      </View>
                      <View style={homeStyles.salonDetails}>
                        <Text numberOfLines={1} style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17 }}>
                          {b.salonName}
                        </Text>
                        <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 }}>
                          {[b.neighborhood, b.city].filter(Boolean).join(" • ")}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Featured salons / server-side search results */}
        <SectionHeader
          title={query.trim()
            ? searching ? (fr ? "Recherche en cours" : "Searching") : `${data?.total ?? 0} ${fr ? "résultat" : "result"}${data?.total !== 1 ? "s" : ""}`
            : (fr ? "Salons en vedette" : "Featured salons")}
          action={query ? "" : (fr ? "Tout voir" : "View all")}
          serifFont={serif}
          onPressAction={() => router.push("/salons" as never)}
          textColor={PALETTE.text}
          accentColor={PALETTE.gold}
        />
        {searching ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        ) : isError ? (
          <Pressable onPress={() => refetch()} style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <Text style={{ color: PALETTE.textMuted }}>{fr ? "Impossible de charger les salons. Réessayer." : "Salons couldn’t be loaded. Try again."}</Text>
          </Pressable>
        ) : featured.length === 0 ? (
          <Text style={{ paddingHorizontal: 20, color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 14, marginBottom: 32 }}>
            {query ? (fr ? "Aucun salon ne correspond." : "No salons match your search.") : (fr ? "Bientôt — nos premiers salons partenaires." : "Our first partner salons are coming soon.")}
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 16 }}
            style={{ marginBottom: 36 }}
          >
            {featured.map((b, idx) => (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/salon/${b.id}` as never)}
                style={({ pressed }) => ({ width: 230, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ aspectRatio: 4 / 3, borderRadius: 18, overflow: "hidden" }}>
                  <ShimmerImage key={b.logoUrl || b.cardImageUrl || "default"} source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  {b.rating && Number(b.rating) > 0 ? (
                    <View style={{ position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Feather name="star" size={11} color={PALETTE.gold} />
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>{Number(b.rating).toFixed(1)}</Text>
                    </View>
                  ) : (
                    <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: PALETTE.gold, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: PALETTE.onGold, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" }}>{fr ? "Nouveau" : "New"}</Text>
                    </View>
                  )}
                </View>
                <View style={homeStyles.salonDetails}>
                <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 18, marginBottom: 4 }} numberOfLines={1}>{b.salonName}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="map-pin" size={10} color={PALETTE.textMuted} />
                  <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }} numberOfLines={1}>
                    {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                  </Text>
                </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!!query.trim() && !searching && !isError && (data?.total ?? 0) > list.length && (
          <Pressable onPress={() => router.push({ pathname: "/salons", params: { search: query.trim() } })}
            style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold" }}>{fr ? `Voir les ${data?.total} résultats →` : `View all ${data?.total} results →`}</Text>
          </Pressable>
        )}

        {/* Style inspiration */}
        {!query && (
          <>
            <SectionHeader
              title={fr ? "L’Inspiration" : "Style inspiration"}
              action={fr ? "Galerie" : "Gallery"}
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

            <View testID="home-salon-catalog-preview" style={{ marginBottom: 27 }}>
              <SectionHeader title={fr ? "Explorer les salons" : "Explore salons"} action="" serifFont={serif}
                textColor={PALETTE.text} accentColor={PALETTE.gold} />
              <View style={{ paddingHorizontal: 20, gap: 5 }}>
                {(newest?.data.length ? newest.data : list).slice(0, 5).map((salon, index) => (
                  <SalonListRow key={salon.id} salon={salon} index={index} onPress={() => router.push(`/salon/${salon.id}`)} />
                ))}
                <Pressable accessibilityRole="button" onPress={() => router.push("/salons")}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderRadius: 14,
                    paddingHorizontal: 14, marginTop: 8, borderWidth: 1, borderColor: PALETTE.border, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>{fr ? "Voir le catalogue des salons" : "Browse the salon directory"}</Text>
                  <Feather name="arrow-right" size={18} color={PALETTE.gold} />
                </Pressable>
              </View>
            </View>

            {/* Barber CTA */}
            {!isSignedIn && (
              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <View style={{ borderWidth: 1, borderColor: `${PALETTE.gold}40`, borderRadius: 20, backgroundColor: PALETTE.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${PALETTE.gold}15`, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="scissors" size={22} color={PALETTE.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 17, marginBottom: 4 }}>{fr ? "Vous êtes barbier ?" : "Are you a barber?"}</Text>
                    <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
                      {fr ? "Publiez votre salon et gérez vos rendez-vous." : "List your salon and manage your appointments."}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/sign-up")} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: "center", borderRadius: 14, backgroundColor: PALETTE.gold }}>
                    <Text style={{ color: PALETTE.onGold, fontFamily: "Inter_700Bold", fontSize: 12 }}>{fr ? "Démarrer" : "Get started"}</Text>
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
    <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Text accessibilityRole="header" style={{ color: textColor, fontFamily: serifFont, fontSize: 24, flexShrink: 1 }}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onPressAction} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ color: textColor, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{action}</Text>
          <Feather name="arrow-right" size={15} color={accentColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const homeStyles = StyleSheet.create({
  salonDetails: { paddingHorizontal: 2, paddingTop: 8, paddingBottom: 3 },
});
