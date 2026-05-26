import { Feather } from "@expo/vector-icons";
import {
  useCreateReservation,
  useGetBarber,
  useListBarberServices,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Avatar, Button, Card, Pill, SectionTitle } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

export default function BarberDetail() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const barberId = Number(id);

  const { data: barber, isLoading } = useGetBarber(barberId);
  const { data: services } = useListBarberServices(barberId);
  const createReservation = useCreateReservation();

  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  if (isLoading || !barber) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const today = new Date();
  const slots: Array<{ label: string; iso: string }> = [];
  for (let d = 0; d < 3; d++) {
    for (const h of [10, 12, 14, 16]) {
      const dt = new Date(today);
      dt.setDate(today.getDate() + d);
      dt.setHours(h, 0, 0, 0);
      slots.push({
        label: dt.toLocaleString("fr-FR", {
          weekday: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        iso: dt.toISOString(),
      });
    }
  }

  const handleBook = () => {
    if (!selectedService || !selectedSlot) {
      Alert.alert("Sélection requise", "Choisissez un service et un créneau.");
      return;
    }
    createReservation.mutate(
      {
        data: {
          barberId,
          serviceId: selectedService,
          scheduledAt: selectedSlot,
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Réservation envoyée", "Votre demande a été transmise au salon.");
          router.replace("/(client)/bookings");
        },
        onError: () => {
          Alert.alert("Erreur", "Impossible de créer la réservation.");
        },
      },
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Avatar name={barber.salonName} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
            {barber.salonName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Feather name="map-pin" size={12} color={c.mutedForeground} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {barber.neighborhood ? `${barber.neighborhood}, ${barber.city}` : barber.city}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            {barber.rating && Number(barber.rating) > 0 ? (
              <Pill
                label={`${Number(barber.rating).toFixed(1)} (${barber.reviewCount ?? 0})`}
                tone="primary"
                icon="star"
              />
            ) : null}
          </View>
        </View>
      </View>

      {barber.bio ? (
        <Card>
          <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 }}>
            {barber.bio}
          </Text>
        </Card>
      ) : null}

      <View>
        <SectionTitle title="Services" />
        <View style={{ gap: 10 }}>
          {(services ?? []).map((s) => {
            const active = selectedService === s.id;
            return (
              <Card
                key={s.id}
                onPress={() => setSelectedService(s.id)}
                style={{
                  borderColor: active ? c.primary : c.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                      {s.name}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {s.durationMinutes} min
                    </Text>
                  </View>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {Number(s.price).toLocaleString("fr-FR")} F
                  </Text>
                </View>
              </Card>
            );
          })}
          {(services ?? []).length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              Aucun service disponible pour le moment.
            </Text>
          ) : null}
        </View>
      </View>

      <View>
        <SectionTitle title="Créneaux disponibles" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {slots.map((slot) => {
            const active = selectedSlot === slot.iso;
            return (
              <Pressable
                key={slot.iso}
                onPress={() => setSelectedSlot(slot.iso)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: c.radius,
                  backgroundColor: active ? c.primary : c.card,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.border,
                }}
              >
                <Text
                  style={{
                    color: active ? c.primaryForeground : c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {slot.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        label="Réserver"
        icon="check"
        onPress={handleBook}
        loading={createReservation.isPending}
        fullWidth
      />
    </ScrollView>
  );
}
