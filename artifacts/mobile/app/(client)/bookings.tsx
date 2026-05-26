import { useListReservations } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Card, EmptyState, Pill } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "confirmed" | "completed" | "cancelled";

export default function Bookings() {
  const c = useColors();
  const router = useRouter();
  const { t, locale } = useApp();
  const [filter, setFilter] = useState<Status | "all">("all");
  const { data, isLoading, refetch, isRefetching } = useListReservations(
    filter === "all" ? undefined : { status: filter },
  );

  const items = data?.data ?? [];

  const STATUS_LABEL: Record<Status, string> = {
    pending: t.statusPending,
    confirmed: t.statusConfirmed,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };

  const STATUS_TONE: Record<Status, "warning" | "success" | "primary" | "danger"> = {
    pending: "warning",
    confirmed: "success",
    completed: "primary",
    cancelled: "danger",
  };

  const filters: Array<{ key: Status | "all"; label: string }> = [
    { key: "all", label: t.filterAll },
    { key: "pending", label: t.filterPending },
    { key: "confirmed", label: t.filterConfirmed },
    { key: "completed", label: t.filterCompleted },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexWrap: "wrap",
        }}
      >
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
            <EmptyState icon="calendar" title={t.noBookings} description={t.noBookingsDesc} />
          }
          renderItem={({ item }) => {
            const status = (item.status ?? "pending") as Status;
            const date = new Date(item.scheduledAt);
            return (
              <Pressable
                onPress={() => item.barberId && router.push(`/salon/${item.barberId}` as never)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                      {date.toLocaleDateString(locale, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                    <Pill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
                  </View>
                  <Text
                    style={{
                      color: c.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    {date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {item.notes ? (
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                      }}
                    >
                      {item.notes}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
