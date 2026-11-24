import { Feather } from "@expo/vector-icons";
import { useListFavorites } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { SalonListRow } from "@/components/SalonListRow";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

export default function Favorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const c = useColors();
  const PALETTE = { bg: c.background, text: c.foreground, textMuted: c.mutedForeground, gold: c.primary };
  const { data, isLoading, refetch, isRefetching } = useListFavorites();

  const items = data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PALETTE.gold} />}
      >
        <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 24, marginBottom: 18 }}>
          {t.favoritesTitle}
        </Text>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
            <Feather name="heart" size={36} color={PALETTE.textMuted} />
            <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 16 }}>{t.favoritesEmpty}</Text>
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
              {t.favoritesEmptyDesc}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {items.map((b) => <SalonListRow key={b.id} salon={b} onPress={() => router.push(`/salon/${b.id}`)} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
