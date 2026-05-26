import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Card, EmptyState, Pill, SectionTitle, StatBlock } from "@/components/UI";
import { CreateSalonModal } from "@/components/CreateSalonModal";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type Bucket = { revenue: number; completedCount: number; upcomingCount: number; totalCount: number };
type RevenueData = { today: Bucket; week: Bucket; month: Bucket; year: Bucket; allTime: Bucket };
type MyBarber = { id: number; salonName: string; status: string };
type MyBarbers = MyBarber[];
type Reservation = {
  id: number; scheduledAt: string; status: "pending" | "confirmed" | "completed" | "cancelled";
  clientName?: string | null; serviceName?: string | null; servicePrice?: number | null;
};

type Period = "today" | "week" | "month" | "year";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Semaine",
  month: "Mois",
  year: "Année",
};

export default function BarberDashboard() {
  const c = useColors();
  const router = useRouter();
  const { t, locale } = useApp();
  const fetcher = useAuthedFetch();
  const [period, setPeriod] = useState<Period>("today");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: salons, isLoading: barberLoading, error: barberError, refetch: refetchBarber } = useQuery<MyBarbers>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarbers>("/api/barbers/me"),
  });

  const barber = salons && salons.length > 0 ? salons[selectedIdx] ?? salons[0] : null;

  const { data: revenue } = useQuery<RevenueData>({
    queryKey: ["myRevenue"],
    queryFn: () => fetcher<RevenueData>("/api/barbers/me/revenue"),
  });

  const { data: reservations } = useQuery<{ data: Reservation[]; total: number }>({
    queryKey: ["myReservations"],
    queryFn: () => fetcher<{ data: Reservation[]; total: number }>("/api/reservations?limit=50"),
  });

  if (barberLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (barberError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24, gap: 12 }}>
        <Feather name="alert-circle" size={32} color={c.destructive} />
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>
          Impossible de charger votre salon
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
          Vérifiez votre connexion et réessayez.
        </Text>
        <Pressable
          onPress={() => refetchBarber()}
          style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: c.primary }}
        >
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  // No salon yet — prompt to create one
  if (!barberLoading && salons && salons.length === 0) {
    return (
      <>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 32, gap: 16 }}>
          <Feather name="scissors" size={40} color={c.primary} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" }}>
            Créez votre premier salon
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
            Publiez votre salon pour commencer à recevoir des réservations.
          </Text>
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={{ paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999, backgroundColor: c.primary }}
          >
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Créer un salon</Text>
          </Pressable>
        </View>
        <CreateSalonModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  if (!barber) return null;

  const periodData = revenue?.[period];
  const allTime = revenue?.allTime;

  const upcoming = (reservations?.data ?? [])
    .filter((r) => r.status === "pending" || r.status === "confirmed")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
    >
      <View>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{t.hello} 👋</Text>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 4 }}>{barber.salonName}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          <Pill
            label={barber.status === "approved" ? t.salonApproved : t.salonPending}
            tone={barber.status === "approved" ? "success" : "warning"}
            icon={barber.status === "approved" ? "check" : "clock"}
          />
        </View>
      </View>

      {/* Multi-salon selector — shown when barber owns more than one salon */}
      {salons && salons.length > 1 && (
        <View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
            Mes salons
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {salons.map((s, idx) => {
              const active = idx === selectedIdx;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedIdx(idx)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: active ? c.primary : c.muted,
                    borderWidth: 1,
                    borderColor: active ? c.primary : c.border,
                  }}
                >
                  <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {s.salonName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Period selector */}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 999,
                backgroundColor: active ? c.primary : c.muted,
                alignItems: "center",
              }}
            >
              <Text style={{
                color: active ? c.primaryForeground : c.mutedForeground,
                fontFamily: "Inter_600SemiBold", fontSize: 12,
              }}>{PERIOD_LABEL[p]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ backgroundColor: c.primary }}>
        <Text style={{ color: c.primaryForeground, opacity: 0.8, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Revenu — {PERIOD_LABEL[period]}
        </Text>
        <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 32, marginTop: 6 }}>
          {(periodData?.revenue ?? 0).toLocaleString()} FC
        </Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          <View>
            <Text style={{ color: c.primaryForeground, opacity: 0.7, fontFamily: "Inter_500Medium", fontSize: 11 }}>Terminés</Text>
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>{periodData?.completedCount ?? 0}</Text>
          </View>
          <View>
            <Text style={{ color: c.primaryForeground, opacity: 0.7, fontFamily: "Inter_500Medium", fontSize: 11 }}>À venir</Text>
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>{periodData?.upcomingCount ?? 0}</Text>
          </View>
          <View>
            <Text style={{ color: c.primaryForeground, opacity: 0.7, fontFamily: "Inter_500Medium", fontSize: 11 }}>Total</Text>
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>{periodData?.totalCount ?? 0}</Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatBlock label="Revenu total" value={`${(allTime?.revenue ?? 0).toLocaleString()} FC`} icon="trending-up" />
        <StatBlock label="Total rdv" value={allTime?.totalCount ?? 0} icon="calendar" />
      </View>

      {/* Shortcuts */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Shortcut c={c} icon="clock" label="Horaires" onPress={() => router.push("/(barber)/hours")} />
        <Shortcut c={c} icon="calendar" label="Créneaux" onPress={() => router.push("/(barber)/slots")} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Shortcut c={c} icon="scissors" label="Services" onPress={() => router.push("/(barber)/services")} />
        <Shortcut c={c} icon="plus-circle" label="Nouveau salon" onPress={() => setCreateOpen(true)} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Shortcut c={c} icon="dollar-sign" label="Financement" onPress={() => router.push("/(barber)/financing")} />
      </View>
      <CreateSalonModal visible={createOpen} onClose={() => setCreateOpen(false)} />

      <View>
        <SectionTitle title="Prochains rendez-vous" action={{ label: "Tout voir", onPress: () => router.push("/(barber)/schedule") }} />
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar" title={t.noAppointments} description={t.noAppointmentsDesc} />
        ) : (
          <View style={{ gap: 10 }}>
            {upcoming.map((r) => {
              const dt = new Date(r.scheduledAt);
              return (
                <Card key={r.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 12, backgroundColor: c.accent,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{dt.getDate()}</Text>
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 9 }}>
                        {dt.toLocaleString(locale, { month: "short" }).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} · {r.clientName ?? "Client"}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {r.serviceName ?? "Service"}
                      </Text>
                    </View>
                    <Pill
                      label={r.status === "confirmed" ? "Confirmé" : "En attente"}
                      tone={r.status === "confirmed" ? "success" : "warning"}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Shortcut({ c, icon, label, onPress }: {
  c: ReturnType<typeof useColors>;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.85 : 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent,
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name={icon} size={16} color={c.primary} />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{label}</Text>
          </View>
        </Card>
      )}
    </Pressable>
  );
}
