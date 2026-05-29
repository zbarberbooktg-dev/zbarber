import { Feather } from "@expo/vector-icons";
import { useListFavorites } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { resolveObjectUrl } from "@/lib/imageUpload";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  gold: "#D4AF37",
};

const salonFallbacks: ImageSourcePropType[] = [
  require("../../assets/images/client-home/salon1.png"),
  require("../../assets/images/client-home/salon2.png"),
  require("../../assets/images/client-home/salon3.png"),
];

export default function Favorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useApp();
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
            {items.map((b, idx) => {
              const logo = resolveObjectUrl(b.logoUrl);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/salon/${b.id}` as never)}
                  style={{ flexDirection: "row", gap: 14, padding: 14, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, alignItems: "center" }}
                >
                  <Image
                    source={logo ? { uri: logo } : salonFallbacks[idx % salonFallbacks.length]}
                    style={{ width: 72, height: 72, borderRadius: 6 }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }} numberOfLines={1}>
                      {b.salonName}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                      <Feather name="map-pin" size={10} color={PALETTE.textMuted} />
                      <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }} numberOfLines={1}>
                        {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                      </Text>
                    </View>
                    {b.rating && Number(b.rating) > 0 ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="star" size={10} color={PALETTE.gold} />
                        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{Number(b.rating).toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={20} color={PALETTE.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
