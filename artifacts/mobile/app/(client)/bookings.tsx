import { useListReservations } from "@workspace/api-client-react";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { Card, EmptyState, Pill } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "confirmed" | "completed" | "cancelled";

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
};

const STATUS_TONE: Record<Status, "warning" | "success" | "primary" | "danger"> = {
  pending: "warning",
  confirmed: "success",
  completed: "primary",
  cancelled: "danger",
};

export default function Bookings() {
  const c = useColors();
  const [filter, setFilter] = useState<Status | "all">("all");
  const { data, isLoading, refetch, isRefetching } = useListReservations(
    filter === "all" ? undefined : { status: filter },
  );

  const items = data?.data ?? [];

  const filters: Array<{ key: Status | "all"; label: string }> = [
    { key: "all", label: "Tous" },
    { key: "pending", label: "En attente" },
    { key: "confirmed", label: "Confirmés" },
    { key: "completed", label: "Terminés" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.muted,
              }}
            >
              <Text
                style={{
                  color: active ? c.primaryForeground : c.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title="Aucune réservation"
              description="Vos rendez-vous apparaîtront ici"
            />
          }
          renderItem={({ item }) => {
            const status = (item.status ?? "pending") as Status;
            const date = new Date(item.scheduledAt);
            return (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {date.toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                  <Pill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
                </View>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 4 }}>
                  {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                {item.notes ? (
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {item.notes}
                  </Text>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
