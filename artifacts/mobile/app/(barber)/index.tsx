import {
  useGetBarber,
  useGetBarberStats,
  useListReservations,
} from "@workspace/api-client-react";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Card, EmptyState, Pill, SectionTitle, StatBlock } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const BARBER_ID = 1;

export default function BarberDashboard() {
  const c = useColors();
  const { t, locale } = useApp();
  const { data: barber, isLoading } = useGetBarber(BARBER_ID);
  const { data: stats } = useGetBarberStats(BARBER_ID);
  const { data: reservations } = useListReservations({ barberId: BARBER_ID });

  if (isLoading || !barber) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.background,
        }}
      >
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const todayItems = (reservations?.data ?? []).slice(0, 4);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
    >
      <View>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
          {t.hello} 👋
        </Text>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 4 }}>
          {barber.salonName}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          <Pill
            label={barber.status === "approved" ? t.salonApproved : t.salonPending}
            tone={barber.status === "approved" ? "success" : "warning"}
            icon={barber.status === "approved" ? "check" : "clock"}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatBlock label={t.statReservations} value={stats?.totalReservations ?? 0} icon="calendar" />
        <StatBlock label={t.statThisMonth} value={stats?.monthlyReservations ?? 0} icon="trending-up" />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatBlock label={t.statProfileViews} value={stats?.profileViews ?? 0} icon="eye" />
        <StatBlock label={t.statClicks} value={stats?.totalClicks ?? 0} icon="mouse-pointer" />
      </View>

      <View>
        <SectionTitle title={t.upcomingAppointments} />
        {todayItems.length === 0 ? (
          <EmptyState icon="calendar" title={t.noAppointments} description={t.noAppointmentsDesc} />
        ) : (
          <View style={{ gap: 10 }}>
            {todayItems.map((r) => {
              const dt = new Date(r.scheduledAt);
              return (
                <Card key={r.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: c.accent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                        {dt.getDate()}
                      </Text>
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 9 }}>
                        {dt.toLocaleString(locale, { month: "short" }).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {t.reservationN}
                        {r.id}
                      </Text>
                    </View>
                    <Pill
                      label={r.status ?? "pending"}
                      tone={
                        r.status === "confirmed"
                          ? "success"
                          : r.status === "cancelled"
                            ? "danger"
                            : "warning"
                      }
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
