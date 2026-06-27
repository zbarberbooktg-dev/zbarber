import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch, withSalon } from "@/lib/api";

type AdvancedStats = {
  topServices: { serviceId: number | null; name: string; count: number; revenue: number }[];
  peakHours: { hour: number; count: number }[];
  peakDays: { day: number; count: number }[];
  cancellationRate: number;
  noShowRate: number;
  completedTotal: number;
  cancelledTotal: number;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function BarberStats() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { selectedSalonId } = useApp();

  const { data, isLoading } = useQuery<AdvancedStats>({
    queryKey: ["myAdvancedStats", selectedSalonId],
    queryFn: () => fetcher<AdvancedStats>(withSalon("/api/barbers/me/stats/advanced", selectedSalonId)),
  });

  const maxHour = data ? Math.max(1, ...data.peakHours.map((h) => h.count)) : 1;
  const maxDay = data ? Math.max(1, ...data.peakDays.map((d) => d.count)) : 1;
  const maxSvc = data ? Math.max(1, ...data.topServices.map((s) => s.count)) : 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Feather name="arrow-left" size={22} color={c.foreground} onPress={() => router.back()} />
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20, flex: 1 }}>Statistiques</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : !data || data.completedTotal === 0 ? (
        <EmptyState icon="bar-chart-2" title="Pas encore de données" description="Vos statistiques apparaîtront après vos premières prestations terminées." />
      ) : (
        <>
          {/* Summary cards */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SummaryCard c={c} icon="check-circle" label="Terminées" value={String(data.completedTotal)} />
            <SummaryCard c={c} icon="x-circle" label="Annulées" value={String(data.cancelledTotal)} />
            <SummaryCard c={c} icon="percent" label="Taux annul." value={`${Math.round(data.cancellationRate * 100)}%`} />
          </View>

          {/* Top services */}
          <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>Services les plus demandés</Text>
            {data.topServices.map((s) => (
              <View key={`${s.serviceId}-${s.name}`} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {s.count} · {s.revenue.toLocaleString()} FC
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: c.muted, overflow: "hidden" }}>
                  <View style={{ width: `${(s.count / maxSvc) * 100}%`, height: "100%", backgroundColor: c.primary }} />
                </View>
              </View>
            ))}
          </View>

          {/* Peak days */}
          <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>Jours les plus actifs</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: 6 }}>
              {data.peakDays.map((d) => (
                <View key={d.day} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View style={{ width: "100%", height: 90, justifyContent: "flex-end" }}>
                    <View style={{ width: "100%", height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0, backgroundColor: c.primary, borderRadius: 4 }} />
                  </View>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>{DAY_LABELS[d.day]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Peak hours */}
          <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>Heures de pointe</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 2 }}>
              {data.peakHours.filter((h) => h.hour >= 6 && h.hour <= 21).map((h) => (
                <View key={h.hour} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <View style={{ width: "100%", height: 80, justifyContent: "flex-end" }}>
                    <View style={{ width: "100%", height: `${(h.count / maxHour) * 100}%`, minHeight: h.count > 0 ? 3 : 0, backgroundColor: c.primary, borderRadius: 2 }} />
                  </View>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 8 }}>{h.hour}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SummaryCard({ c, icon, label, value }: { c: ReturnType<typeof useColors>; icon: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 12, gap: 6 }}>
      <Feather name={icon} size={16} color={c.primary} />
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}
