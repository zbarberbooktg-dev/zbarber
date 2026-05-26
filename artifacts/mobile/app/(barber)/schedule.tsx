import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Button, Card, EmptyState, Pill } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type Status = "pending" | "confirmed" | "completed" | "cancelled";

type Reservation = {
  id: number;
  scheduledAt: string;
  status: Status;
  clientName?: string | null;
  clientPhone?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
};

function sanitizePhone(p: string) {
  return p.replace(/[^\d+]/g, "");
}

const TONE: Record<Status, "warning" | "success" | "primary" | "danger"> = {
  pending: "warning",
  confirmed: "success",
  completed: "primary",
  cancelled: "danger",
};

export default function BarberSchedule() {
  const c = useColors();
  const { t, locale } = useApp();
  const fetcher = useAuthedFetch();
  const [filter, setFilter] = useState<Status | "all" | "today">("today");

  const { data, isLoading, refetch, isRefetching } = useQuery<{ data: Reservation[]; total: number }>({
    queryKey: ["myReservations", filter === "all" || filter === "today" ? "all" : filter],
    queryFn: () => {
      const status = filter !== "all" && filter !== "today" ? `&status=${filter}` : "";
      return fetcher(`/api/reservations?limit=200${status}`);
    },
  });

  const allItems = data?.data ?? [];
  const items = filter === "today"
    ? allItems.filter((r) => {
        const d = new Date(r.scheduledAt);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      })
    : allItems;

  const STATUS_LABEL: Record<Status, string> = {
    pending: t.statusPending,
    confirmed: t.statusConfirmed,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };

  const filters: Array<{ key: Status | "all" | "today"; label: string }> = [
    { key: "today", label: "Aujourd'hui" },
    { key: "all", label: t.filterAll },
    { key: "pending", label: t.filterPending },
    { key: "confirmed", label: t.filterConfirmed },
    { key: "completed", label: t.filterCompleted },
  ];

  const handleUpdate = async (id: number, status: Status) => {
    try {
      await fetcher(`/api/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refetch();
    } catch {
      // surface via refetch reload
    }
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
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: active ? c.primary : c.muted,
              }}
            >
              <Text style={{
                color: active ? c.primaryForeground : c.mutedForeground,
                fontFamily: "Inter_600SemiBold", fontSize: 12,
              }}>{f.label}</Text>
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
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={
            <EmptyState icon="calendar" title={t.noBookingsBarber} description={t.noBookingsBarberDesc} />
          }
          renderItem={({ item }) => {
            const status = item.status;
            const dt = new Date(item.scheduledAt);
            return (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {dt.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Pill label={STATUS_LABEL[status]} tone={TONE[status]} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {item.clientName ?? "Client"}
                  </Text>
                  {item.clientPhone && (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => Linking.openURL(`tel:${sanitizePhone(item.clientPhone!)}`).catch(() => {})}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: c.accent }}
                      >
                        <Feather name="phone" size={14} color={c.primary} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => Linking.openURL(`https://wa.me/${sanitizePhone(item.clientPhone!).replace(/^\+/, "")}`).catch(() => {})}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: c.accent }}
                      >
                        <Feather name="message-circle" size={14} color={c.primary} />
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, marginBottom: 12 }}>
                  {item.serviceName ?? "Service"}
                  {item.servicePrice != null ? ` · ${Number(item.servicePrice).toLocaleString()} FC` : ""}
                </Text>
                {status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button label={t.confirm} icon="check" onPress={() => handleUpdate(item.id, "confirmed")} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={t.refuse} variant="ghost" icon="x" onPress={() => handleUpdate(item.id, "cancelled")} />
                    </View>
                  </View>
                ) : status === "confirmed" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button label={t.markCompleted} variant="secondary" icon="check-circle" onPress={() => handleUpdate(item.id, "completed")} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label="Annuler" variant="ghost" icon="x" onPress={() => handleUpdate(item.id, "cancelled")} />
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
