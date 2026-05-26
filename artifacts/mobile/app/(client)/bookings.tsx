import { useListReservations, useUpdateReservationStatus } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Card, EmptyState, Pill } from "@/components/UI";
import { ReviewModal } from "@/components/ReviewModal";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "confirmed" | "completed" | "cancelled";

export default function Bookings() {
  const c = useColors();
  const router = useRouter();
  const { t, locale } = useApp();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [reviewFor, setReviewFor] = useState<{ barberId: number; salonName?: string } | null>(null);
  const { data, isLoading, refetch, isRefetching } = useListReservations(
    filter === "all" ? undefined : { status: filter },
  );
  const updateStatus = useUpdateReservationStatus();

  const items = data?.data ?? [];

  const handleCancel = (id: number, scheduledAt: string, barberId?: number | null) => {
    const hours = (new Date(scheduledAt).getTime() - Date.now()) / 36e5;
    if (hours < 24) {
      Alert.alert(
        "Annulation impossible",
        "Vous ne pouvez annuler une réservation que jusqu'à 24h avant le rendez-vous. Contactez directement le salon.",
      );
      return;
    }
    Alert.alert(
      "Annuler la réservation ?",
      "Cette action est définitive. Vous pourrez réserver à nouveau.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Annuler le rdv",
          style: "destructive",
          onPress: async () => {
            try {
              await updateStatus.mutateAsync({ id, data: { status: "cancelled" } });
              refetch();
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Impossible d'annuler.");
            }
          },
        },
      ],
    );
  };

  const handleReschedule = (barberId?: number | null) => {
    if (!barberId) return;
    Alert.alert(
      "Modifier le rendez-vous",
      "Pour modifier, annulez ce rendez-vous puis prenez-en un nouveau sur la page du salon.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Voir le salon", onPress: () => router.push(`/salon/${barberId}` as never) },
      ],
    );
  };

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
            const canModify =
              (status === "pending" || status === "confirmed") &&
              (date.getTime() - Date.now()) / 36e5 >= 24;
            return (
              <Card>
                <Pressable
                  onPress={() => item.barberId && router.push(`/salon/${item.barberId}` as never)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
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
                </Pressable>
                {canModify && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                    <Pressable
                      onPress={() => handleReschedule(item.barberId)}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 9, borderRadius: c.radius - 4,
                        backgroundColor: c.muted, alignItems: "center", opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        Modifier
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleCancel(item.id, item.scheduledAt, item.barberId)}
                      disabled={updateStatus.isPending}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 9, borderRadius: c.radius - 4,
                        borderWidth: 1, borderColor: c.destructive, alignItems: "center",
                        opacity: pressed || updateStatus.isPending ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ color: c.destructive, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        Annuler
                      </Text>
                    </Pressable>
                  </View>
                )}
                {(status === "pending" || status === "confirmed") && !canModify && (
                  <Text style={{ marginTop: 10, color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, fontStyle: "italic" }}>
                    Modification/annulation indisponible (moins de 24h avant).
                  </Text>
                )}
                {status === "completed" && item.barberId && (
                  <Pressable
                    onPress={() => setReviewFor({ barberId: item.barberId as number })}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                      paddingTop: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14 }}>⭐</Text>
                    <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {t.leaveReview ?? "Laisser un avis"}
                    </Text>
                  </Pressable>
                )}
              </Card>
            );
          }}
        />
      )}
      {reviewFor && (
        <ReviewModal
          visible={!!reviewFor}
          onClose={() => setReviewFor(null)}
          barberId={reviewFor.barberId}
          salonName={reviewFor.salonName}
          onSubmitted={() => refetch()}
        />
      )}
    </View>
  );
}
