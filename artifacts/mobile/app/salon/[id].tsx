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
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ScrollHint } from "@/components/ScrollHint";

const WEEK_DAYS_ORDER: Array<{ key: string; label: string }> = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const salonFallbacks: ImageSourcePropType[] = [
  require("../../assets/images/client-home/salon1.png"),
  require("../../assets/images/client-home/salon2.png"),
  require("../../assets/images/client-home/salon3.png"),
];

export default function PublicSalonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const barberId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { locale, user, t } = useApp();
  const fetcher = useAuthedFetch();
  const [scrolled, setScrolled] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  const { data: barber, isLoading } = useGetBarber(barberId);
  const { data: servicesData } = useListBarberServices(barberId);
  const { data: reviewsData } = useListReviews({ barberId });
  const { data: galleryData } = useGetBarberGallery(barberId);
  const { data: scheduleData } = useGetBarberSchedule(barberId);

  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  // Favorites (only meaningful when signed in as a client)
  const { data: favorites, refetch: refetchFavorites } = useListFavorites({ query: { enabled: isSignedIn } as never });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const isFavorite = (favorites ?? []).some((f) => f.id === barberId);
  const togglingFavorite = addFavorite.isPending || removeFavorite.isPending;

  // Loyalty status (only when signed in)
  const { data: loyalty } = useGetMyLoyalty(barberId, { query: { enabled: isSignedIn } as never });

  // Before/after realisations (public)
  const { data: realisationsData } = useListBarberRealisations(barberId);
  const realisations = realisationsData ?? [];

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
      if (isFavorite) {
        await removeFavorite.mutateAsync({ barberId });
      } else {
        await addFavorite.mutateAsync({ data: { barberId } });
      }
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
      await Share.share({
        message: `${t.shareMessage} : ${barber.salonName}\n${url}`,
        url,
        title: barber.salonName,
      });
    } catch {
      // user dismissed share sheet — no-op
    }
  };

  const services = (servicesData ?? []).filter((s) => s.isActive);
  const reviews = reviewsData?.data ?? [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
      : 0;

  // Fetch real availability based on weekly hours + selected service duration + bookings + days off.
  const fromIso = React.useMemo(() => {
    const d = new Date(); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);
  const toIso = React.useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 13);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const { data: availability } = useQuery<Array<{ date: string; isWorking: boolean; isBlocked: boolean; slots: Array<{ time: string; iso: string; available: boolean; reason?: string }> }>>({
    queryKey: ["availability", barberId, selectedService, fromIso, toIso],
    queryFn: () => fetcher(`/api/barbers/${barberId}/availability?from=${fromIso}&to=${toIso}${selectedService ? `&serviceId=${selectedService}` : ""}`),
    enabled: !!barberId,
  });

  const slots = React.useMemo(() => {
    const result: Array<{ label: string; iso: string }> = [];
    if (!availability) return result;
    for (const day of availability) {
      if (!day.isWorking || day.isBlocked) continue;
      const dayDate = new Date(day.date + "T00:00:00");
      const dayLabel = dayDate.toLocaleDateString(locale, { weekday: "short", day: "numeric" });
      for (const s of day.slots) {
        if (!s.available) continue;
        result.push({ label: `${dayLabel} · ${s.time}`, iso: s.iso });
      }
    }
    return result;
  }, [availability, locale]);

  const handleBook = async () => {
    if (!isSignedIn) {
      Alert.alert(
        "Connexion requise",
        "Créez un compte ou connectez-vous pour réserver.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/(auth)/sign-in") },
        ],
      );
      return;
    }
    if (!selectedService || !selectedSlot) {
      Alert.alert("Sélection incomplète", "Choisissez un service et un créneau.");
      return;
    }
    if (user?.role === "barber") {
      Alert.alert("Réservation impossible", "Un barbier ne peut pas réserver une prestation.");
      return;
    }
    setBooking(true);
    try {
      await fetcher("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ barberId, serviceId: selectedService, scheduledAt: selectedSlot }),
      });
      Alert.alert("Réservation envoyée !", "Le barbier confirmera bientôt votre rendez-vous.", [
        { text: "Voir mes réservations", onPress: () => router.replace("/(client)/bookings") },
        { text: "OK" },
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer la réservation.");
    } finally {
      setBooking(false);
    }
  };

  if (isLoading || !barber) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={PALETTE.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom back header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingTop: insets.top + 12,
        paddingHorizontal: 14,
        paddingBottom: 12,
        backgroundColor: PALETTE.bg,
        borderBottomWidth: 1,
        borderBottomColor: PALETTE.border,
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={{ flex: 1, color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 17 }} numberOfLines={1}>
          {barber.salonName}
        </Text>
        {avgRating > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 14 }}>
            <Feather name="star" size={13} color={PALETTE.gold} />
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {avgRating.toFixed(1)}
            </Text>
          </View>
        )}
        <Pressable onPress={handleShare} hitSlop={10} style={{ marginRight: 14 }}>
          <Feather name="share-2" size={20} color={PALETTE.text} />
        </Pressable>
        <Pressable onPress={handleToggleFavorite} hitSlop={10} disabled={togglingFavorite}>
          <Feather
            name="heart"
            size={21}
            color={isFavorite ? PALETTE.gold : PALETTE.text}
            style={{ opacity: togglingFavorite ? 0.5 : 1 }}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={(e) => {
          if (!scrolled && e.nativeEvent.contentOffset.y > 30) setScrolled(true);
        }}
        scrollEventThrottle={32}
      >
        {/* Hero carousel — barber's works (gallery) or fallback to logo */}
        {(() => {
          const screenW = Dimensions.get("window").width;
          const heroH = Math.round(screenW * 9 / 16);
          const heroSlides: Array<{ key: string; source: ImageSourcePropType }> =
            galleryData && galleryData.length > 0
              ? galleryData.map((p) => ({
                  key: String(p.id),
                  source: { uri: resolveObjectUrl(p.photoUrl)! },
                }))
              : [
                  {
                    key: "fallback",
                    source: barber.logoUrl
                      ? { uri: resolveObjectUrl(barber.logoUrl)! }
                      : salonFallbacks[barberId % salonFallbacks.length],
                  },
                ];

          const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / screenW);
            if (i !== heroIndex) setHeroIndex(i);
          };

          return (
            <View style={{ width: "100%", height: heroH, backgroundColor: PALETTE.surface }}>
              <FlatList
                data={heroSlides}
                keyExtractor={(it) => it.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onHeroScroll}
                scrollEventThrottle={32}
                renderItem={({ item }) => (
                  <Image
                    source={item.source}
                    style={{ width: screenW, height: heroH }}
                    resizeMode="cover"
                  />
                )}
              />

              {/* Dark gradient overlay at bottom for legibility */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute", left: 0, right: 0, bottom: 0, height: 80,
                  backgroundColor: "rgba(0,0,0,0.45)",
                }}
              />

              {/* Salon logo badge (only when gallery is shown) */}
              {galleryData && galleryData.length > 0 && barber.logoUrl && (
                <View style={{
                  position: "absolute", bottom: 12, left: 16,
                  width: 56, height: 56, borderRadius: 28,
                  borderWidth: 2, borderColor: PALETTE.gold,
                  overflow: "hidden", backgroundColor: PALETTE.surface,
                }}>
                  <Image
                    source={{ uri: resolveObjectUrl(barber.logoUrl)! }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* "Works" badge */}
              {galleryData && galleryData.length > 0 && (
                <View style={{
                  position: "absolute", top: 12, left: 16,
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
                }}>
                  <Feather name="image" size={12} color={PALETTE.gold} />
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                    {t.galleryWorks ?? "Réalisations"} · {galleryData.length}
                  </Text>
                </View>
              )}

              {/* Pagination counter */}
              {heroSlides.length > 1 && (
                <View style={{
                  position: "absolute", top: 12, right: 16,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
                }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                    {heroIndex + 1} / {heroSlides.length}
                  </Text>
                </View>
              )}

              {/* Dots */}
              {heroSlides.length > 1 && (
                <View style={{
                  position: "absolute", bottom: 10, right: 16,
                  flexDirection: "row", gap: 5,
                }}>
                  {heroSlides.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === heroIndex ? 16 : 6, height: 6, borderRadius: 3,
                        backgroundColor: i === heroIndex ? PALETTE.gold : "rgba(255,255,255,0.55)",
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })()}

        {/* Salon info */}
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 24, marginBottom: 4 }}>
                {barber.salonName}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="map-pin" size={12} color={PALETTE.textMuted} />
                <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  {barber.neighborhood ? `${barber.neighborhood} • ${barber.city}` : barber.city}
                </Text>
              </View>
            </View>
            {reviews.length > 0 && (
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                  {avgRating.toFixed(1)}
                </Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Feather key={n} name="star" size={9} color={n <= Math.round(avgRating) ? PALETTE.gold : PALETTE.border} />
                  ))}
                </View>
                <Text style={{ color: PALETTE.textDim, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                  {reviews.length} avis
                </Text>
              </View>
            )}
          </View>
          {barber.bio && (
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>
              {barber.bio}
            </Text>
          )}
          {barber.phone && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
              <Feather name="phone" size={13} color={PALETTE.gold} />
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 13 }}>{barber.phone}</Text>
            </View>
          )}
          {isSignedIn && loyalty && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: `${PALETTE.gold}12`,
                borderColor: `${PALETTE.gold}40`,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Feather name="award" size={16} color={PALETTE.gold} />
                <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>{t.loyaltyTitle}</Text>
              </View>
              {loyalty.freeAvailable > 0 ? (
                <Text style={{ color: PALETTE.gold, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>
                  {loyalty.freeAvailable > 1
                    ? t.loyaltyFreeAvailablePlural.replace("{n}", String(loyalty.freeAvailable))
                    : t.loyaltyFreeAvailable}
                </Text>
              ) : (
                <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 10 }}>
                  {t.loyaltyUntilNext.replace("{n}", String(loyalty.untilNext))}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
                {Array.from({ length: loyalty.threshold }).map((_, i) => {
                  const filled = i < loyalty.completed % loyalty.threshold || (loyalty.completed > 0 && loyalty.completed % loyalty.threshold === 0);
                  return (
                    <View
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: filled ? PALETTE.gold : "transparent",
                        borderWidth: 1,
                        borderColor: filled ? PALETTE.gold : PALETTE.border,
                      }}
                    >
                      {i === loyalty.threshold - 1 ? (
                        <Feather name="gift" size={11} color={filled ? PALETTE.bg : PALETTE.textDim} />
                      ) : (
                        <Feather name="scissors" size={10} color={filled ? PALETTE.bg : PALETTE.textDim} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          {barber.latitude && barber.longitude ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  const lat = Number(barber.latitude);
                  const lng = Number(barber.longitude);
                  const label = encodeURIComponent(barber.salonName);
                  const url = Platform.select({
                    ios: `maps:0,0?q=${label}@${lat},${lng}`,
                    android: `geo:0,0?q=${lat},${lng}(${label})`,
                    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                  })!;
                  Linking.openURL(url).catch(() =>
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`),
                  );
                }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 10, paddingHorizontal: 12,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  borderWidth: 1, borderColor: PALETTE.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Feather name="map-pin" size={13} color={PALETTE.text} />
                <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  Voir sur la carte
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const lat = Number(barber.latitude);
                  const lng = Number(barber.longitude);
                  const label = encodeURIComponent(barber.salonName);
                  const url = Platform.select({
                    ios: `maps://?daddr=${lat},${lng}&q=${label}&dirflg=d`,
                    android: `google.navigation:q=${lat},${lng}&mode=d`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                  })!;
                  Linking.openURL(url).catch(() =>
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`),
                  );
                }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 10, paddingHorizontal: 12,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  backgroundColor: PALETTE.gold,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Feather name="navigation" size={13} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 12 }}>
                  Itinéraire
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>


        {/* Schedule */}
        {scheduleData?.workDays && scheduleData.workDays.length > 0 && (
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
            <SectionTitle title="Horaires d'ouverture" />
            <View style={{ gap: 6 }}>
              {WEEK_DAYS_ORDER.map(({ key, label }) => {
                const wd = scheduleData.workDays.find((x) => x.day === key);
                const open = wd && wd.isWorking && wd.startTime && wd.endTime;
                return (
                  <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
                    <Text style={{ color: PALETTE.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>{label}</Text>
                    <Text style={{ color: open ? PALETTE.gold : PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                      {open ? `${wd!.startTime} – ${wd!.endTime}` : "Fermé"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Services */}
        {services.length === 0 ? (
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border, alignItems: "center", gap: 10 }}>
            <Feather name="scissors" size={28} color={PALETTE.textDim} />
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center" }}>
              Ce salon n'a pas encore publié ses services
            </Text>
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
              Contactez-le directement {barber.phone ? `au ${barber.phone}` : "pour réserver"}.
            </Text>
          </View>
        ) : (
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
            <SectionTitle title="Services" />
            {services.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedService(s.id === selectedService ? null : s.id)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                  backgroundColor: selectedService === s.id ? `${PALETTE.gold}18` : PALETTE.surface,
                  borderWidth: 1,
                  borderColor: selectedService === s.id ? PALETTE.gold : PALETTE.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{s.name}</Text>
                  {s.description && (
                    <Text style={{ color: PALETTE.textDim, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}>
                      {s.description}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    {Number(s.price).toLocaleString()} FC
                  </Text>
                  <Text style={{ color: PALETTE.textDim, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    {s.durationMinutes} min
                  </Text>
                </View>
                {selectedService === s.id && (
                  <View style={{ marginLeft: 10 }}>
                    <Feather name="check-circle" size={16} color={PALETTE.gold} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Before / after realisations */}
        {realisations.length > 0 && (
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
            <SectionTitle title="Avant / Après" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {realisations.map((r) => (
                <View key={r.id} style={{ width: 240, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 12, overflow: "hidden" }}>
                  <View style={{ flexDirection: "row" }}>
                    {[{ uri: resolveObjectUrl(r.beforeUrl), tag: "Avant" }, { uri: resolveObjectUrl(r.afterUrl), tag: "Après" }].map((img, i) => (
                      <View key={i} style={{ flex: 1, aspectRatio: 1, position: "relative" }}>
                        {img.uri && <Image source={{ uri: img.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
                        <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
                          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>{img.tag}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  {(r.caption || services.find((s) => s.id === r.serviceId)) && (
                    <Text numberOfLines={1} style={{ color: PALETTE.textMuted, fontFamily: "Inter_500Medium", fontSize: 12, padding: 10 }}>
                      {r.caption || services.find((s) => s.id === r.serviceId)?.name}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Time slots */}
        {selectedService && (
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
            <SectionTitle title="Choisir un créneau" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {slots.map((sl) => (
                <Pressable
                  key={sl.iso}
                  onPress={() => setSelectedSlot(sl.iso === selectedSlot ? null : sl.iso)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: selectedSlot === sl.iso ? PALETTE.gold : PALETTE.surface,
                    borderWidth: 1,
                    borderColor: selectedSlot === sl.iso ? PALETTE.gold : PALETTE.border,
                    minWidth: 100,
                    alignItems: "center",
                  }}
                >
                  <Text style={{
                    color: selectedSlot === sl.iso ? "#000" : PALETTE.text,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    textAlign: "center",
                  }}>
                    {sl.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={{ padding: 14 }}>
            <SectionTitle title="Avis clients" />
            {reviews.slice(0, 5).map((r) => (
              <View key={r.id} style={{
                backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border,
                padding: 14, marginBottom: 10,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16, backgroundColor: `${PALETTE.gold}20`,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Feather name="user" size={14} color={PALETTE.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Client #{r.clientId}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Feather key={n} name="star" size={10} color={n <= (r.rating ?? 0) ? PALETTE.gold : PALETTE.border} />
                      ))}
                    </View>
                  </View>
                </View>
                {r.comment && (
                  <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 }}>
                    {r.comment}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed booking CTA — only when this salon has bookable services */}
      {services.length > 0 && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 14,
          paddingTop: 16,
          backgroundColor: PALETTE.bg,
          borderTopWidth: 1,
          borderTopColor: PALETTE.border,
          gap: 8,
        }}>
          {selectedService && selectedSlot && (
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>
              {services.find((s) => s.id === selectedService)?.name} —{" "}
              {slots.find((sl) => sl.iso === selectedSlot)?.label}
            </Text>
          )}
          <Pressable
            onPress={handleBook}
            disabled={booking}
            style={({ pressed }) => ({
              backgroundColor: booking ? PALETTE.border : PALETTE.gold,
              paddingVertical: 16,
              alignItems: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            {booking ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {isSignedIn ? "Réserver" : "Se connecter pour réserver"}
              </Text>
            )}
          </Pressable>
        </View>
      )}
      <ScrollHint label={t.scrollToBook ?? "Faites défiler pour réserver"} visible={!scrolled && services.length > 0} />

      {services.length === 0 && barber.phone && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingBottom: insets.bottom + 16, paddingHorizontal: 14, paddingTop: 16,
          backgroundColor: PALETTE.bg, borderTopWidth: 1, borderTopColor: PALETTE.border,
        }}>
          <Pressable
            onPress={() => Linking.openURL(`tel:${barber.phone}`)}
            style={({ pressed }) => ({
              paddingVertical: 16, alignItems: "center",
              borderWidth: 1, borderColor: PALETTE.gold,
              flexDirection: "row", justifyContent: "center", gap: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Feather name="phone" size={16} color={PALETTE.gold} />
            <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              Appeler le salon
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
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
