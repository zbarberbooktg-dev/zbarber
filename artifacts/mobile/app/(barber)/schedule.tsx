import {
  useListReservations,
  useUpdateReservationStatus,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Button, Card, EmptyState, Pill } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const BARBER_ID = 1;
type Status = "pending" | "confirmed" | "completed" | "cancelled";

const TONE: Record<Status, "warning" | "success" | "primary" | "danger"> = {
  pending: "warning",
  confirmed: "success",
  completed: "primary",
  cancelled: "danger",
};

export default function BarberSchedule() {
  const c = useColors();
  const [filter, setFilter] = useState<Status | "all">("all");
  const { data, isLoading, refetch, isRefetching } = useListReservations({
    barberId: BARBER_ID,
    ...(filter !== "all" ? { status: filter } : {}),
  });
  const updateStatus = useUpdateReservationStatus();

  const items = data?.data ?? [];

  const filters: Array<{ key: Status | "all"; label: string }> = [
    { key: "all", label: "Tous" },
    { key: "pending", label: "En attente" },
    { key: "confirmed", label: "Confirmés" },
    { key: "completed", label: "Terminés" },
  ];

  const handleUpdate = (id: number, status: Status) => {
    updateStatus.mutate({ id, data: { status } }, { onSuccess: () => refetch() });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: "wrap" }}>
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
              description="Les demandes apparaîtront ici"
            />
          }
          renderItem={({ item }) => {
            const status = (item.status ?? "pending") as Status;
            const dt = new Date(item.scheduledAt);
            return (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}{" "}
                    · {dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Pill label={status} tone={TONE[status]} />
                </View>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12 }}>
                  Réservation #{item.id}
                </Text>
                {status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Confirmer"
                        icon="check"
                        onPress={() => handleUpdate(item.id, "confirmed")}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Refuser"
                        variant="ghost"
                        icon="x"
                        onPress={() => handleUpdate(item.id, "cancelled")}
                      />
                    </View>
                  </View>
                ) : status === "confirmed" ? (
                  <Button
                    label="Marquer terminé"
                    variant="secondary"
                    icon="check-circle"
                    onPress={() => handleUpdate(item.id, "completed")}
                    fullWidth
                  />
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
