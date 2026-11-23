import { Feather } from "@expo/vector-icons";
import {
  useAddFavorite,
  useGetBarber,
  useGetBarberGallery,
  useGetBarberSchedule,
  useGetMyLoyalty,
  useListBarberRealisations,
  useListBarberServices,
  useListFavorites,
  useListBarberPanoramas,
  useListReviews,
  useRemoveFavorite,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageSourcePropType,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";
import { Image } from "expo-image";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { SalonPhotoGallery } from "@/components/SalonPhotoGallery";
import { PanoramaViewer } from "@/components/PanoramaViewer";
import { useColors } from "@/hooks/useColors";
import { coordinates } from "@/lib/salonSearch";
import { salonReservationHref } from "@/lib/reservationRoute";

const WEEK_DAYS_ORDER: Array<{ key: string; label: string }> = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];
const JS_DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function useSalonPalette() {
  const colors = useColors();
  return {
    bg: colors.background,
    surface: colors.card,
    border: colors.border,
    text: colors.foreground,
    textMuted: colors.mutedForeground,
    textDim: colors.mutedForeground,
    // Gold remains the button fill; accent foreground stays readable on light surfaces.
    gold: colors.accentForeground,
    primary: colors.primary,
    onPrimary: colors.isDark ? colors.primaryForeground : colors.foreground,
    accent: colors.accent,
    muted: colors.muted,
  };
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const salonFallbacks: ImageSourcePropType[] = [
  require("../../assets/images/client-home/salon1.png"),
  require("../../assets/images/client-home/salon2.png"),
  require("../../assets/images/client-home/salon3.png"),
];

function formatDuration(min?: number | null) {
  const m = Number(min ?? 0);
  if (!m) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export default function PublicSalonDetail() {
  const PALETTE = useSalonPalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const barberId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { locale, t } = useApp();
  const fetcher = useAuthedFetch();
  const [heroLightbox, setHeroLightbox] = useState<number | null>(null);
  const [realisationLbIdx, setRealisationLbIdx] = useState<number | null>(null);

  const { data: barber, isLoading, isError, refetch } = useGetBarber(barberId);
  const servicesQ = useListBarberServices(barberId);
  const servicesData = servicesQ.data;
  const { data: reviewsData } = useListReviews({ barberId });
  const { data: galleryData } = useGetBarberGallery(barberId);
  const { data: scheduleData } = useGetBarberSchedule(barberId);

  const { data: favorites, refetch: refetchFavorites } = useListFavorites({ query: { enabled: isSignedIn } as never });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const isFavorite = (favorites ?? []).some((f) => f.id === barberId);
  const togglingFavorite = addFavorite.isPending || removeFavorite.isPending;

  const { data: loyalty } = useGetMyLoyalty(barberId, { query: { enabled: isSignedIn } as never });

  const { data: realisationsData } = useListBarberRealisations(barberId);
  const realisations = realisationsData ?? [];

  const { data: panoramasData } = useListBarberPanoramas(barberId);
  const panoramas = panoramasData ?? [];
  const [tourOpen, setTourOpen] = useState(false);

  // Public home-service config (enabled flag) for this salon.
  const { data: homeService } = useQuery<{ enabled: boolean }>({
    queryKey: ["homeServicePublic", barberId],
    queryFn: () => fetcher(`/api/barbers/${barberId}/home-service`),
    enabled: !!barberId,
  });
  const homeServiceEnabled = !!homeService?.enabled;

  const heroSlides = React.useMemo<Array<{ key: string; source: ImageSourcePropType }>>(() => {
    if (galleryData && galleryData.length > 0) {
      return galleryData.map((p) => ({ key: String(p.id), source: { uri: resolveObjectUrl(p.photoUrl, 1200)! } }));
    }
    return [{
      key: "fallback",
      source: barber?.logoUrl ? { uri: resolveObjectUrl(barber.logoUrl, 1200)! } : salonFallbacks[barberId % salonFallbacks.length],
    }];
  }, [galleryData, barber, barberId]);

  const isFr = String(locale).startsWith("fr");

  const handleToggleFavorite = async () => {
    if (!isSignedIn) {
      Alert.alert(
        isFr ? "Connexion requise" : "Sign in required",
        isFr ? "Connectez-vous pour enregistrer vos salons favoris." : "Sign in to save your favorite salons.",
        [
          { text: isFr ? "Annuler" : "Cancel", style: "cancel" },
          { text: isFr ? "Se connecter" : "Sign in", onPress: () => router.push("/(auth)/sign-in") },
        ]);
      return;
    }
    try {
      if (isFavorite) await removeFavorite.mutateAsync({ barberId });
      else await addFavorite.mutateAsync({ data: { barberId } });
      refetchFavorites();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Action impossible.");
    }
  };

  const handleShare = async () => {
    if (!barber) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}/salon/${barberId}` : `mobile://salon/${barberId}`;
    try {
      await Share.share({ message: `${t.shareMessage} : ${barber.salonName}\n${url}`, url, title: barber.salonName });
    } catch {
      // dismissed
    }
  };

  const openBooking = () => {
    const href = salonReservationHref(String(barberId));
    if (href) router.push(href);
  };

  const services = (servicesData ?? []).filter((s) => s.isActive);
  const servicesLoading = !!servicesQ.isLoading && !servicesData;
  const servicesError = !!servicesQ.isError && !servicesData;
  const reviews = reviewsData?.data ?? [];
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length : 0;

  const priceRange = React.useMemo(() => {
    const prices = services.map((s) => Number(s.price)).filter(Number.isFinite);
    if (!prices.length) return null;
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? `${min.toLocaleString()} FC` : `${min.toLocaleString()} – ${max.toLocaleString()} FC`;
  }, [services]);

  const todayInfo = React.useMemo(() => {
    const wd = scheduleData?.workDays?.find((x) => x.day === JS_DAY_KEYS[new Date().getDay()]);
    if (!scheduleData?.workDays?.length) return null;
    if (wd && wd.isWorking && wd.startTime && wd.endTime) return { open: true, label: `${wd.startTime} – ${wd.endTime}` };
    return { open: false, label: isFr ? "Fermé aujourd'hui" : "Closed today" };
  }, [scheduleData, isFr]);

  const openMap = () => {
    if (!barber) return;
    const lat = Number(barber.latitude), lng = Number(barber.longitude);
    const label = encodeURIComponent(barber.salonName);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    })!;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`));
  };

  const openDirections = () => {
    if (!barber) return;
    const lat = Number(barber.latitude), lng = Number(barber.longitude);
    const encoded = encodeURIComponent(barber.salonName);
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const nativeUrl = Platform.select({
      ios: `maps://?daddr=${lat},${lng}&q=${encoded}&dirflg=d`,
      default: `geo:0,0?q=${lat},${lng}(${encoded})`,
    })!;
    Alert.alert("Ouvrir l'itinéraire dans…", undefined, [
      { text: Platform.OS === "ios" ? "Plans" : "Carte native", onPress: () => Linking.openURL(nativeUrl).catch(() => Linking.openURL(googleUrl)) },
      { text: "Google Maps", onPress: () => Linking.openURL(googleUrl) },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  if (isLoading || !barber) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <Stack.Screen options={{ headerShown: false }} />
        {isError ? <Pressable accessibilityRole="button" onPress={() => { void refetch(); }} style={{ padding: 18 }}>
          <Text style={{ color: PALETTE.text }}>{isFr ? "Impossible de charger le salon. Réessayer" : "Could not load this salon. Try again"}</Text>
        </Pressable> : <ActivityIndicator color={PALETTE.gold} />}
      </View>
    );
  }

  const hasCoords = !!coordinates(barber.latitude, barber.longitude);
  const address = barber.address;
  const card = {
    backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border,
    borderRadius: 18, padding: 18,
  } as const;
  const section = { paddingHorizontal: 16, marginTop: 22, width: "100%", maxWidth: 900, alignSelf: "center" } as const;
  const eyebrow = { color: PALETTE.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 } as const;

  // Loyalty card math (guards against a 0/absent threshold)
  const threshold = Number(loyalty?.threshold ?? 0);
  const completed = Number(loyalty?.completed ?? 0);
  const freeAvailable = Number(loyalty?.freeAvailable ?? 0);
  const stampsInCycle = threshold > 0 ? completed % threshold : 0;
  const untilNext = threshold > 0 ? (Number(loyalty?.untilNext ?? 0) || threshold - stampsInCycle) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: 12,
        backgroundColor: PALETTE.bg, borderBottomWidth: 1, borderBottomColor: PALETTE.border,
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }} hitSlop={10} accessibilityRole="button" accessibilityLabel={isFr ? "Retour" : "Back"} testID="salon-back">
          <Feather name="arrow-left" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={{ flex: 1, color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 17 }} numberOfLines={1}>
          {barber.salonName}
        </Text>
        <Pressable onPress={handleShare} hitSlop={10} style={{ marginRight: 16 }} accessibilityRole="button" accessibilityLabel={isFr ? "Partager le salon" : "Share salon"} testID="salon-share">
          <Feather name="share-2" size={20} color={PALETTE.text} />
        </Pressable>
        <Pressable onPress={handleToggleFavorite} hitSlop={10} disabled={togglingFavorite} accessibilityRole="button"
          accessibilityState={{ selected: isFavorite }} accessibilityLabel={isFr ? (isFavorite ? "Retirer des favoris" : "Ajouter aux favoris") : (isFavorite ? "Remove favorite" : "Add favorite")} testID="salon-favorite">
          <Feather name="heart" size={21} color={isFavorite ? PALETTE.primary : PALETTE.text} style={{ opacity: togglingFavorite ? 0.5 : 1 }} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Full-width photos (contain, never cropped) */}
        <SalonPhotoGallery
          slides={heroSlides}
          isGallery={!!galleryData && galleryData.length > 0}
          isFr={isFr}
          worksLabel={t.galleryWorks}
          colors={PALETTE}
          onOpen={(i) => setHeroLightbox(i)}
        />

        {/* Intro */}
        <View style={section}>
          <View style={{ ...card, borderColor: `${PALETTE.primary}55`, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {barber.logoUrl ? (
                <Image source={{ uri: resolveObjectUrl(barber.logoUrl, 200)! }}
                  style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: PALETTE.bg, borderWidth: 1, borderColor: PALETTE.border }}
                  contentFit="contain" accessibilityLabel={isFr ? "Logo du salon" : "Salon logo"} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: PALETTE.accent, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="scissors" size={26} color={PALETTE.gold} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={eyebrow}>{isFr ? "Salon Zbarber" : "Zbarber salon"}</Text>
                <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 26, lineHeight: 31 }}>{barber.salonName}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <Feather name="map-pin" size={13} color={PALETTE.textMuted} />
                  <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 14, flexShrink: 1 }}>
                    {barber.neighborhood ? `${barber.neighborhood} • ${barber.city}` : barber.city}
                  </Text>
                </View>
              </View>
            </View>

            {barber.bio ? (
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 24, marginTop: 16 }}>
                {barber.bio}
              </Text>
            ) : null}

            {/* Key facts */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
              {reviews.length > 0 && (
                <Fact icon="star" label={isFr ? "Note" : "Rating"} value={`${avgRating.toFixed(1)} / 5 · ${reviews.length} avis`} />
              )}
              {services.length > 0 && (
                <Fact icon="scissors" label="Services" value={`${services.length} ${isFr ? "proposés" : "offered"}`} />
              )}
              {priceRange && <Fact icon="tag" label={isFr ? "Tarifs" : "Prices"} value={priceRange} />}
              {todayInfo && <Fact icon="clock" label={isFr ? "Aujourd'hui" : "Today"} value={todayInfo.label} />}
            </View>

            {homeServiceEnabled && (
              <View testID="salon-home-service" style={{
                flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 12,
                backgroundColor: PALETTE.accent, borderWidth: 1, borderColor: `${PALETTE.primary}55`,
              }}>
                <Feather name="navigation" size={16} color={PALETTE.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>{t.hsSubtitle}</Text>
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                    {isFr ? "Choix du lieu et frais de déplacement à l'étape de réservation." : "Pick the location and travel fee when booking."}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Services overview */}
        <View style={section} testID="salon-services" accessibilityLabel={isFr ? "Services et tarifs" : "Services and prices"}>
          <Text style={eyebrow}>{isFr ? "La carte" : "The menu"}</Text>
          <SectionTitle title={isFr ? "Services et tarifs" : "Services & prices"} />
          {servicesLoading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ ...card, height: 84, backgroundColor: PALETTE.muted, borderColor: PALETTE.muted }} />
              ))}
            </View>
          ) : servicesError ? (
            <View style={{ ...card, alignItems: "center", gap: 10 }}>
              <Feather name="wifi-off" size={24} color={PALETTE.textMuted} />
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center" }}>
                {isFr ? "Impossible de charger les services" : "Couldn't load services"}
              </Text>
              {servicesQ.refetch && (
                <Pressable onPress={() => servicesQ.refetch?.()} testID="salon-services-retry" accessibilityRole="button"
                  style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: PALETTE.primary }}>
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{isFr ? "Réessayer" : "Retry"}</Text>
                </Pressable>
              )}
            </View>
          ) : services.length === 0 ? (
            <View style={{ ...card, alignItems: "center", gap: 10 }}>
              <Feather name="scissors" size={28} color={PALETTE.textDim} />
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>
                Ce salon n'a pas encore publié ses services
              </Text>
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                Contactez-le directement {barber.phone ? `au ${barber.phone}` : "pour réserver"}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {services.map((s: any) => {
                const dur = formatDuration(s.durationMinutes ?? s.duration);
                return (
                  <View key={s.id} testID={`salon-service-${s.id}`} style={{ ...card, flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                    <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: PALETTE.primary }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 16 }}>{s.name}</Text>
                      {s.description ? (
                        <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 4 }}>
                          {s.description}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                        <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                          {Number(s.price).toLocaleString()} FC
                        </Text>
                        {dur && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Feather name="clock" size={13} color={PALETTE.textMuted} />
                            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 13 }}>{dur}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 360 tour */}
        {panoramas.length > 0 && (
          <View style={section}>
            <SectionTitle title="Visite 360°" />
            <Pressable onPress={() => setTourOpen(true)} testID="salon-tour" accessibilityRole="button" accessibilityLabel="Explorer en 360°"
              style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: PALETTE.border }}>
              <Image source={{ uri: resolveObjectUrl(panoramas[0].imageUrl, 900)! }} style={{ width: "100%", aspectRatio: 2 }} contentFit="cover" />
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: PALETTE.primary, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="compass" size={26} color={PALETTE.onPrimary} />
                </View>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 10 }}>Explorer en 360°</Text>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 }}>
                  {panoramas.length > 1 ? `${panoramas.length} pièces à visiter` : "Visite immersive"}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Before / after */}
        {realisations.length > 0 && (
          <View style={section}>
            <SectionTitle title="Avant / Après" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {realisations.map((r, ri) => (
                <View key={r.id} style={{ width: 270 }}>
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    {[{ uri: resolveObjectUrl(r.beforeUrl, 500), tag: "Avant" }, { uri: resolveObjectUrl(r.afterUrl, 500), tag: "Après" }].map((img, i) => (
                      <Pressable key={i} onPress={() => setRealisationLbIdx(ri * 2 + i)} accessibilityRole="imagebutton" accessibilityLabel={`${img.tag}`}
                        style={{ flex: 1, aspectRatio: 1, borderRadius: 14, overflow: "hidden" }}>
                        {img.uri && <Image source={{ uri: img.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                        <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
                          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>{img.tag}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  {(r.caption || services.find((s: any) => s.id === r.serviceId)) && (
                    <Text numberOfLines={2} style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 13, padding: 12 }}>
                      {r.caption || services.find((s: any) => s.id === r.serviceId)?.name}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Practical info: hours + address + contact */}
        <View style={section}>
          <Text style={eyebrow}>{isFr ? "Infos pratiques" : "Practical info"}</Text>
          {scheduleData?.workDays && scheduleData.workDays.length > 0 && (
            <View style={{ ...card, marginBottom: 12 }}>
              <SectionTitle title="Horaires d'ouverture" />
              {WEEK_DAYS_ORDER.map(({ key, label }, idx) => {
                const wd = scheduleData.workDays.find((x) => x.day === key);
                const open = wd && wd.isWorking && wd.startTime && wd.endTime;
                const isToday = JS_DAY_KEYS[new Date().getDay()] === key;
                return (
                  <View key={key} style={{
                    flexDirection: "row", justifyContent: "space-between", paddingVertical: 9,
                    borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: PALETTE.border,
                  }}>
                    <Text style={{ color: PALETTE.text, fontFamily: isToday ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }}>{label}</Text>
                    <Text style={{ color: open ? PALETTE.text : PALETTE.textMuted, fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular", fontSize: 14 }}>
                      {open ? `${wd!.startTime} – ${wd!.endTime}` : "Fermé"}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ ...card, gap: 12 }}>
            <SectionTitle title={isFr ? "Adresse et contact" : "Address & contact"} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Feather name="map-pin" size={16} color={PALETTE.primary} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>
                {[address, barber.neighborhood, barber.city].filter(Boolean).join(", ")}
              </Text>
            </View>
            {barber.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${barber.phone}`)} testID="salon-call-inline" accessibilityRole="button"
                accessibilityLabel={isFr ? `Appeler le ${barber.phone}` : `Call ${barber.phone}`} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Feather name="phone" size={16} color={PALETTE.primary} />
                <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 14, textDecorationLine: "underline" }}>{barber.phone}</Text>
              </Pressable>
            ) : null}
            {hasCoords && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <Pressable onPress={openMap} testID="salon-map" accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: PALETTE.border, opacity: pressed ? 0.85 : 1 })}>
                  <Feather name="map" size={14} color={PALETTE.text} />
                  <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Voir sur la carte</Text>
                </Pressable>
                <Pressable onPress={openDirections} testID="salon-directions" accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: PALETTE.primary, backgroundColor: PALETTE.accent, opacity: pressed ? 0.85 : 1 })}>
                  <Feather name="navigation" size={14} color={PALETTE.gold} />
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>Itinéraire</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={section}>
            <View style={card}>
              <Accordion title={isFr ? "Avis clients" : "Client reviews"} count={reviews.length}>
                {reviews.slice(0, 5).map((r) => (
                  <View key={r.id} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: PALETTE.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.accent, alignItems: "center", justifyContent: "center" }}>
                        <Feather name="user" size={14} color={PALETTE.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Client #{r.clientId}</Text>
                        <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Feather key={n} name="star" size={11} color={n <= (r.rating ?? 0) ? PALETTE.primary : PALETTE.border} />
                          ))}
                        </View>
                      </View>
                    </View>
                    {r.comment && (
                      <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>{r.comment}</Text>
                    )}
                  </View>
                ))}
              </Accordion>
            </View>
          </View>
        )}

        {/* Loyalty — always last */}
        {isSignedIn && loyalty && threshold > 0 && (
          <View style={section} testID="salon-loyalty" accessibilityLabel={t.loyaltyTitle}>
            <View style={{ ...card, backgroundColor: PALETTE.accent, borderColor: `${PALETTE.primary}66` }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Feather name="award" size={18} color={PALETTE.gold} />
                <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 16 }}>{t.loyaltyTitle}</Text>
              </View>
              {freeAvailable > 0 ? (
                <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 12 }}>
                  {freeAvailable > 1 ? t.loyaltyFreeAvailablePlural.replace("{n}", String(freeAvailable)) : t.loyaltyFreeAvailable}
                </Text>
              ) : untilNext > 0 ? (
                <Text style={{ color: PALETTE.gold, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 12 }}>
                  {t.loyaltyUntilNext.replace("{n}", String(untilNext))}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {Array.from({ length: threshold }).map((_, i) => {
                  const filled = i < stampsInCycle || (completed > 0 && stampsInCycle === 0);
                  return (
                    <View key={i} style={{
                      width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                      backgroundColor: filled ? PALETTE.primary : "transparent", borderWidth: 1, borderColor: filled ? PALETTE.primary : PALETTE.border,
                    }}>
                      <Feather name={i === threshold - 1 ? "gift" : "scissors"} size={12} color={filled ? PALETTE.onPrimary : PALETTE.textDim} />
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: PALETTE.gold, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 10, opacity: 0.85 }}>
                {stampsInCycle || (freeAvailable > 0 ? threshold : 0)} / {threshold} {isFr ? "visites sur cette carte" : "visits on this card"}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Persistent CTA */}
      {services.length > 0 && (
        <View style={{
          paddingBottom: insets.bottom + 14, paddingHorizontal: 16, paddingTop: 14,
          backgroundColor: PALETTE.bg, borderTopWidth: 1, borderTopColor: PALETTE.border,
          flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          {priceRange && (
            <View>
              <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 11 }}>{isFr ? "À partir de" : "From"}</Text>
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>{priceRange.split(" – ")[0].replace(" FC", "")} FC</Text>
            </View>
          )}
          <Pressable
            onPress={openBooking}
            testID="salon-open-booking"
            accessibilityRole="button"
            accessibilityLabel={isFr ? "Réserver dans ce salon" : "Book at this salon"}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: PALETTE.primary, paddingVertical: 16, borderRadius: 14,
              alignItems: "center", opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: PALETTE.onPrimary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {isFr ? "Réserver" : "Book"}
            </Text>
          </Pressable>
        </View>
      )}
      {!servicesLoading && !servicesError && services.length === 0 && barber.phone && (
        <View style={{
          paddingBottom: insets.bottom + 14, paddingHorizontal: 16, paddingTop: 14,
          backgroundColor: PALETTE.bg, borderTopWidth: 1, borderTopColor: PALETTE.border,
        }}>
          <Pressable
            onPress={() => Linking.openURL(`tel:${barber.phone}`)}
            testID="salon-call"
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingVertical: 16, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: PALETTE.primary,
              flexDirection: "row", justifyContent: "center", gap: 8, opacity: pressed ? 0.85 : 1,
            })}
          >
            <Feather name="phone" size={16} color={PALETTE.gold} />
            <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 15 }}>Appeler le salon</Text>
          </Pressable>
        </View>
      )}

      {panoramas.length > 0 && (
        <PanoramaViewer
          scenes={panoramas.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl }))}
          visible={tourOpen}
          onClose={() => setTourOpen(false)}
        />
      )}

      <GalleryLightbox
        items={heroSlides.map((s) => ({ src: s.source }))}
        initialIndex={heroLightbox ?? 0}
        visible={heroLightbox !== null}
        onClose={() => setHeroLightbox(null)}
      />

      <GalleryLightbox
        items={realisations.flatMap((r) => [
          { uri: resolveObjectUrl(r.beforeUrl, 1200), label: "Avant" },
          { uri: resolveObjectUrl(r.afterUrl, 1200), label: "Après" },
        ])}
        initialIndex={realisationLbIdx ?? 0}
        visible={realisationLbIdx !== null}
        onClose={() => setRealisationLbIdx(null)}
      />
    </View>
  );
}

function Fact({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string }) {
  const PALETTE = useSalonPalette();
  return (
    <View style={{ flexGrow: 1, flexBasis: "45%", minWidth: 140, padding: 12, borderRadius: 12, backgroundColor: PALETTE.bg, borderWidth: 1, borderColor: PALETTE.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Feather name={icon} size={12} color={PALETTE.primary} />
        <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.4 }}>{label}</Text>
      </View>
      <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>{value}</Text>
    </View>
  );
}
function SectionTitle({ title }: { title: string }) {
  const PALETTE = useSalonPalette();
  return (
    <Text style={{
      color: PALETTE.text,
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      marginBottom: 14,
    }}>
      {title}
    </Text>
  );
}

function Accordion({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const PALETTE = useSalonPalette();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: open ? 14 : 0,
        }}
        hitSlop={8}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>
            {title}
          </Text>
          {typeof count === "number" && count > 0 && (
            <View style={{ backgroundColor: PALETTE.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {count}
              </Text>
            </View>
          )}
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={20} color={PALETTE.textMuted} />
      </Pressable>
      {open && <View>{children}</View>}
    </View>
  );
}
