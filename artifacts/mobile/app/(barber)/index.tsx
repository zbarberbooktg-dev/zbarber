import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, Pill, SectionTitle, StatBlock } from "@/components/UI";
import { CreateSalonModal } from "@/components/CreateSalonModal";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch, withSalon } from "@/lib/api";
import { setBrowsing } from "@/lib/browseIntent";

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
  const { t, lang, locale, barberProfile } = useApp();
  const fr = lang === "fr";
  const { selectedSalonId, setSelectedSalonId } = useApp();
  const fetcher = useAuthedFetch();
  const [period, setPeriod] = useState<Period>("today");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: salons, isLoading: barberLoading, error: barberError, refetch: refetchBarber } = useQuery<MyBarbers>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarbers>("/api/barbers/me"),
  });

  // Keep the globally-selected salon valid: default to the first salon when
  // nothing is selected yet or the stored selection is no longer owned.
  useEffect(() => {
    if (!salons || salons.length === 0) return;
    if (selectedSalonId == null || !salons.some((s) => s.id === selectedSalonId)) {
      setSelectedSalonId(salons[0]!.id);
    }
  }, [salons, selectedSalonId, setSelectedSalonId]);

  const barber = salons && salons.length > 0
    ? (salons.find((s) => s.id === selectedSalonId) ?? salons[0])
    : null;
  const salonId = barber?.id ?? null;

  const { data: revenue } = useQuery<RevenueData>({
    queryKey: ["myRevenue", salonId],
    enabled: salonId != null,
    queryFn: () => fetcher<RevenueData>(withSalon("/api/barbers/me/revenue", salonId)),
  });

  const { data: reservations } = useQuery<{ data: Reservation[]; total: number }>({
    queryKey: ["myReservations", salonId],
    enabled: salonId != null,
    queryFn: () => fetcher<{ data: Reservation[]; total: number }>(withSalon("/api/reservations?limit=50", salonId)),
  });

  // Legacy pending salons need human approval, not a document.
  if (barberProfile?.status === "awaiting_document") {
    return <Redirect href="/(barber)/pending" />;
  }

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
      <Card style={styles.salonHeader}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>{fr ? "Espace professionnel" : "Barber workspace"}</Text>
          <Text accessibilityRole="header" style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 4 }}>{barber.salonName}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Pill
              label={barber.status === "approved" ? t.salonApproved : t.salonPending}
              tone={barber.status === "approved" ? "success" : "warning"}
              icon={barber.status === "approved" ? "check" : "clock"}
            />
          </View>
        </View>
        <Pressable
          onPress={() => {
            setBrowsing(true);
            router.push("/browse");
          }}
          accessibilityRole="button"
          accessibilityLabel={fr ? "Accueil" : "Home"}
          style={{
            width: 44, height: 44, borderRadius: 14, backgroundColor: c.accent,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name="home" size={18} color={c.primary} />
        </Pressable>
      </Card>

      {/* Multi-salon selector — shown when barber owns more than one salon */}
      {salons && salons.length > 1 && (
        <View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
            Mes salons
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {salons.map((s) => {
              const active = s.id === salonId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedSalonId(s.id)}
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

      <Text accessibilityRole="header" style={[styles.sectionLabel, { color: c.foreground }]}>{fr ? "Vue d’ensemble" : "Overview"}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
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

      <ShortcutGroup c={c} title={fr ? "Réservations et services" : "Bookings and services"} items={[
        { icon: "clock", label: fr ? "Horaires" : "Opening hours", detail: fr ? "Jours et heures d’ouverture" : "Opening days and times", onPress: () => router.push("/(barber)/hours") },
        { icon: "calendar", label: fr ? "Créneaux" : "Time slots", detail: fr ? "Disponibilités pour les rendez-vous" : "Appointment availability", onPress: () => router.push("/(barber)/slots") },
        { icon: "scissors", label: "Services", detail: fr ? "Prestations, tarifs et durées" : "Services, prices and durations", onPress: () => router.push("/(barber)/services") },
        { icon: "users", label: fr ? "File d’attente" : "Waitlist", onPress: () => router.push("/(barber)/queue") },
        { icon: "home", label: t.hsBarberNav, onPress: () => router.push("/(barber)/home-service") },
      ]} />
      <ShortcutGroup c={c} title={fr ? "Vitrine du salon" : "Salon showcase"} items={[
        { icon: "image", label: fr ? "Galerie" : "Gallery", detail: fr ? "Photos visibles par les clients" : "Photos shown to clients", onPress: () => router.push("/(barber)/gallery") },
        { icon: "layers", label: fr ? "Avant / Après" : "Before / After", onPress: () => router.push("/(barber)/realisations") },
        { icon: "compass", label: fr ? "Visite 360°" : "360° tour", onPress: () => router.push("/(barber)/panoramas") },
      ]} />
      <ShortcutGroup c={c} title={fr ? "Gestion du salon" : "Salon management"} items={[
        { icon: "bar-chart-2", label: fr ? "Statistiques" : "Statistics", onPress: () => router.push("/(barber)/stats") },
        { icon: "dollar-sign", label: t.financingTitle, detail: t.comingSoon, onPress: () => router.push("/(barber)/financing") },
        { icon: "plus-circle", label: fr ? "Nouveau salon" : "New salon", onPress: () => setCreateOpen(true) },
      ]} />
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

type ShortcutItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
};

function ShortcutGroup({ c, title, items }: {
  c: ReturnType<typeof useColors>;
  title: string;
  items: ShortcutItem[];
}) {
  return (
    <View style={styles.shortcutGroup}>
      <Text accessibilityRole="header" style={[styles.sectionLabel, { color: c.foreground }]}>{title}</Text>
      <Card style={styles.shortcutCard}>
        {items.map(({ icon, label, detail, onPress }, index) => (
          <Pressable key={icon} accessibilityRole="button" onPress={onPress}
            style={({ pressed }) => [styles.shortcutRow, {
              backgroundColor: pressed ? c.muted : c.card,
              borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
              borderColor: c.border,
            }]}>
            <View style={[styles.shortcutIcon, { backgroundColor: c.accent }]}>
              <Feather name={icon} size={18} color={c.accentForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shortcutLabel, { color: c.foreground }]}>{label}</Text>
              {detail && <Text style={[styles.shortcutDetail, { color: c.mutedForeground }]}>{detail}</Text>}
            </View>
            <Feather name="chevron-right" size={16} color={c.mutedForeground} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  salonHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionLabel: { fontFamily: "Inter_700Bold", fontSize: 18 },
  shortcutGroup: { gap: 9 },
  shortcutCard: { padding: 0, overflow: "hidden" },
  shortcutRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 13, paddingVertical: 9, minHeight: 56 },
  shortcutIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  shortcutLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  shortcutDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 2 },
});
