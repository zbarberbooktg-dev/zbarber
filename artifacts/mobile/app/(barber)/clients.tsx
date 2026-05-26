import { Feather } from "@expo/vector-icons";
import { useListReviews } from "@workspace/api-client-react";
import React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { Avatar, Card, EmptyState } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const BARBER_ID = 1;

export default function BarberReviews() {
  const c = useColors();
  const { t } = useApp();
  const { data, isLoading } = useListReviews({ barberId: BARBER_ID });
  const reviews = data?.data ?? [];

  const avg =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0) / reviews.length
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          ListHeaderComponent={
            <Card style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 32 }}>
                    {avg.toFixed(1)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Feather
                        key={n}
                        name="star"
                        size={12}
                        color={n <= Math.round(avg) ? c.primary : c.muted}
                      />
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}
                  >
                    {t.reviewsCount(reviews.length)}
                  </Text>
                  <Text
                    style={{
                      color: c.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {t.avgRating}
                  </Text>
                </View>
              </View>
            </Card>
          }
          ListEmptyComponent={
            <EmptyState icon="star" title={t.noReviews} description={t.noReviewsDesc} />
          }
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
                <Avatar name={`${t.clientN}${item.clientId}`} size={40} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}
                  >
                    {t.clientN}
                    {item.clientId}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Feather
                        key={n}
                        name="star"
                        size={11}
                        color={n <= (item.rating ?? 0) ? c.primary : c.muted}
                      />
                    ))}
                  </View>
                </View>
              </View>
              {item.comment ? (
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {item.comment}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}
