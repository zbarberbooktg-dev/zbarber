import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button, Card, Pill } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch, withSalon } from "@/lib/api";

type Slot = { time: string; iso: string; available: boolean; reason?: string | null };
type DayAvailability = { date: string; isWorking: boolean; isBlocked: boolean; slots: Slot[] };
type DayOff = { id: number; date: string };
type MyBarber = { id: number };

function ymd(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BarberSlots() {
  const c = useColors();
  const { locale, selectedSalonId } = useApp();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<string>(ymd(new Date()));

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() + i);
      return { iso: ymd(d), label: d.toLocaleDateString(locale, { weekday: "short", day: "numeric" }) };
    });
  }, [locale]);

  const { data: salons } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarber[]>("/api/barbers/me"),
  });
  // Resolve the selected salon (falls back to the first owned salon) so availability
  // and days-off are scoped to whichever salon the barber picked in the dashboard.
  const barberId = (salons?.find((s) => s.id === selectedSalonId) ?? salons?.[0])?.id;

  const range = useMemo(() => {
    const from = days[0]?.iso ?? selectedDate;
    const to = days[days.length - 1]?.iso ?? selectedDate;
    return { from, to };
  }, [days, selectedDate]);

  const { data: availability, isLoading, refetch } = useQuery<DayAvailability[]>({
    queryKey: ["myAvailability", barberId, range.from, range.to],
    enabled: !!barberId,
    queryFn: () => fetcher<DayAvailability[]>(`/api/barbers/${barberId}/availability?from=${range.from}&to=${range.to}`),
  });

  const { data: daysOff } = useQuery<DayOff[]>({
    queryKey: ["myDaysOff", barberId],
    enabled: !!barberId,
    queryFn: () => fetcher<DayOff[]>(withSalon("/api/barbers/me/days-off", barberId)),
  });

  const day = availability?.find((d) => d.date === selectedDate);
  const dayOffForDate = daysOff?.find((d) => d.date === selectedDate);

  const blockDay = async (force: boolean) => {
    await fetcher(withSalon("/api/barbers/me/days-off", barberId), {
      method: "POST",
      body: JSON.stringify({ date: selectedDate, force }),
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["myDaysOff", barberId] }),
      qc.invalidateQueries({ queryKey: ["myAvailability", barberId] }),
    ]);
  };

  const handleToggleDayOff = async () => {
    if (!barberId) return;
    try {
      if (dayOffForDate) {
        await fetcher(withSalon(`/api/barbers/me/days-off/${dayOffForDate.id}`, barberId), { method: "DELETE" });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["myDaysOff", barberId] }),
          qc.invalidateQueries({ queryKey: ["myAvailability", barberId] }),
        ]);
      } else {
        await blockDay(false);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      // Server returned 409 with conflicting_reservations — offer to confirm.
      if (msg.includes("conflicting_reservations")) {
        const m = /"count":(\d+)/.exec(msg);
        const count = m ? Number(m[1]) : 0;
        Alert.alert(
          "Réservations existantes",
          `Cette journée comporte ${count} rendez-vous (en attente ou confirmés). Si vous la bloquez, pensez à prévenir vos clients — leurs RDV resteront enregistrés.`,
          [
            { text: "Annuler", style: "cancel" },
            { text: "Bloquer quand même", style: "destructive", onPress: () => blockDay(true).catch((err) => Alert.alert("Erreur", err?.message ?? "Échec")) },
          ],
        );
        return;
      }
      Alert.alert("Erreur", msg || "Impossible de mettre à jour");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Créneaux du jour", headerBackTitle: "Retour" }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 6 }}>
          {days.map((d) => {
            const active = d.iso === selectedDate;
            const hasOff = daysOff?.some((o) => o.date === d.iso);
            return (
              <Pressable
                key={d.iso}
                onPress={() => setSelectedDate(d.iso)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                  backgroundColor: active ? c.primary : c.muted,
                  borderWidth: 1, borderColor: active ? c.primary : c.border,
                  minWidth: 64, alignItems: "center",
                }}
              >
                <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "capitalize" }}>
                  {d.label}
                </Text>
                {hasOff && <View style={{ marginTop: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: active ? c.primaryForeground : c.destructive }} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Pill
                label={day?.isBlocked ? "Fermé" : day?.isWorking ? "Ouvert" : "Repos"}
                tone={day?.isBlocked ? "danger" : day?.isWorking ? "success" : "neutral"}
              />
            </View>

            {day && !day.isWorking && !day.isBlocked && (
              <Card>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
                  Ce jour n'est pas configuré comme jour travaillé dans vos horaires hebdomadaires.
                </Text>
              </Card>
            )}

            {day?.isBlocked && (
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Feather name="x-circle" size={18} color={c.destructive} />
                  <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    Vous avez bloqué cette journée. Aucun client ne peut réserver.
                  </Text>
                </View>
              </Card>
            )}

            {day && day.isWorking && !day.isBlocked && day.slots.length === 0 && (
              <Card>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  Aucun créneau généré pour ce jour. Vérifiez vos horaires hebdomadaires.
                </Text>
              </Card>
            )}

            {day && day.slots.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {day.slots.map((s) => (
                  <View
                    key={s.iso}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                      backgroundColor: s.available ? c.accent : c.muted,
                      borderWidth: 1, borderColor: s.available ? c.primary : c.border,
                      minWidth: 78, alignItems: "center",
                    }}
                  >
                    <Text style={{ color: s.available ? c.primary : c.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {s.time}
                    </Text>
                    {!s.available && s.reason && (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, marginTop: 2 }}>
                        {s.reason === "booked" ? "Réservé" : s.reason === "past" ? "Passé" : s.reason}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Button
                label={dayOffForDate ? "Réactiver cette journée" : "Bloquer cette journée"}
                variant={dayOffForDate ? "secondary" : "destructive"}
                icon={dayOffForDate ? "rotate-ccw" : "x-octagon"}
                onPress={handleToggleDayOff}
                fullWidth
              />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8, textAlign: "center" }}>
                {dayOffForDate
                  ? "Vos clients pourront à nouveau réserver."
                  : "Aucun créneau ne sera proposé aux clients pour cette date."}
              </Text>
            </View>

            <Pressable onPress={() => refetch()} style={{ alignSelf: "center", marginTop: 8, padding: 8 }}>
              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>Actualiser</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </>
  );
}
