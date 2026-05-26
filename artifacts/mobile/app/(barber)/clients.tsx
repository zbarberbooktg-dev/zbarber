import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Avatar, Card, EmptyState } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type Client = {
  clientId: number;
  name: string;
  phone: string | null;
  email: string;
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  lastVisit: string | null;
};

export default function BarberClients() {
  const c = useColors();
  const { locale } = useApp();
  const fetcher = useAuthedFetch();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ data: Client[]; total: number }>({
    queryKey: ["myClients"],
    queryFn: () => fetcher<{ data: Client[]; total: number }>("/api/barbers/me/clients"),
  });

  const clients = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(c2) => String(c2.clientId)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListHeaderComponent={
            clients.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {data?.total ?? clients.length} client{(data?.total ?? clients.length) > 1 ? "s" : ""} au total
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="users" title="Aucun client" description="Vos clients apparaîtront ici dès la première réservation." />
          }
          renderItem={({ item }) => {
            const last = item.lastVisit ? new Date(item.lastVisit) : null;
            return (
              <Card>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Avatar name={item.name} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{item.name}</Text>
                    {item.phone && (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {item.phone}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
                      <Stat label="Visites" value={item.completedBookings} c={c} />
                      <Stat label="Total" value={`${item.totalSpent.toLocaleString()} FC`} c={c} />
                    </View>
                    {last && (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 8 }}>
                        Dernier rdv : {last.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    )}
                  </View>
                  {item.phone && (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}
                      hitSlop={10}
                      style={{
                        width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                        backgroundColor: c.accent,
                      }}
                    >
                      <Feather name="phone" size={16} color={c.primary} />
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function Stat({ label, value, c }: { label: string; value: string | number; c: ReturnType<typeof useColors> }) {
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{value}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}
