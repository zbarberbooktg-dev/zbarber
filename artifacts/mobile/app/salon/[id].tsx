import { Feather } from "@expo/vector-icons";
import {
  useGetBarber,
  useListBarberServices,
  useListReviews,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from "@clerk/expo";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { locale, user } = useApp();
  const fetcher = useAuthedFetch();

  const { data: barber, isLoading } = useGetBarber(barberId);
  const { data: servicesData } = useListBarberServices(barberId);
  const { data: reviewsData } = useListReviews({ barberId });

  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const services = (servicesData ?? []).filter((s) => s.isActive);
  const reviews = reviewsData?.data ?? [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
      : 0;

  const slots = React.useMemo(() => {
    const result: Array<{ label: string; iso: string }> = [];
    const today = new Date();
    for (let d = 0; d < 4; d++) {
      for (const h of [9, 10, 11, 14, 15, 16]) {
        const dt = new Date(today);
        dt.setDate(today.getDate() + d);
        dt.setHours(h, 0, 0, 0);
        result.push({
          label: dt.toLocaleString(locale, {
            weekday: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          iso: dt.toISOString(),
        });
      }
    }
    return result;
  }, [locale]);

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
        paddingHorizontal: 20,
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="star" size={13} color={PALETTE.gold} />
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {avgRating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero image */}
        <Image
          source={salonFallbacks[barberId % salonFallbacks.length]}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />

        {/* Salon info */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
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
        </View>

        {/* Services */}
        {services.length > 0 && (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
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

        {/* Time slots */}
        {selectedService && (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: PALETTE.border }}>
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
          <View style={{ padding: 20 }}>
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

      {/* Fixed booking CTA */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 20,
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
