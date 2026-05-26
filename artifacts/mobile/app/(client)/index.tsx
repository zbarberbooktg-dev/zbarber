import { Feather } from "@expo/vector-icons";
import { useListBarbers } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar, Card, EmptyState, Pill } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Discover() {
  const c = useColors();
  const router = useRouter();
  const { t } = useApp();
  const [query, setQuery] = useState("");
  const { data, isLoading, refetch, isRefetching } = useListBarbers({ status: "approved" });

  const filtered = useMemo(() => {
    const list = data?.data ?? [];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(
      (b) =>
        b.salonName.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.neighborhood?.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.card,
            borderRadius: c.radius,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Feather name="search" size={18} color={c.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={c.mutedForeground}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              color: c.foreground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState icon="search" title={t.noSalonFound} description={t.noSalonFoundDesc} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/(client)/barber/${item.id}` as never)}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Avatar name={item.salonName} size={56} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: c.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 16,
                      marginBottom: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.salonName}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 6,
                    }}
                  >
                    <Feather name="map-pin" size={11} color={c.mutedForeground} />
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                      }}
                      numberOfLines={1}
                    >
                      {item.neighborhood ? `${item.neighborhood}, ${item.city}` : item.city}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {item.rating && Number(item.rating) > 0 ? (
                      <Pill
                        label={`${Number(item.rating).toFixed(1)} (${item.reviewCount ?? 0})`}
                        tone="primary"
                        icon="star"
                      />
                    ) : (
                      <Pill label={t.newBadge} tone="neutral" />
                    )}
                    {item.subscriptionPlanId ? (
                      <Pill label={t.verified} tone="success" icon="check" />
                    ) : null}
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={c.mutedForeground} />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
