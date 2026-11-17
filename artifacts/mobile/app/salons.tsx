import { Feather } from "@expo/vector-icons";
import { listBarbers } from "@workspace/api-client-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { salonImageSource } from "@/lib/salonDiscovery";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const salonFallbacks: ImageSourcePropType[] = [
  require("../assets/images/client-home/salon1.png"),
  require("../assets/images/client-home/salon2.png"),
  require("../assets/images/client-home/salon3.png"),
];

export default function AllSalons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string }>();
  const [query, setQuery] = useState(params.search ?? "");
  const [search, setSearch] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["/api/barbers", "directory", search],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listBarbers({ status: "approved", search: search || undefined, limit: 20, page: pageParam }, { signal }),
    getNextPageParam: (page) => page.page * page.limit < page.total ? page.page + 1 : undefined,
    staleTime: 30000, refetchOnMount: "always",
  });
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));
  const list = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: PALETTE.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>
          Tous les salons
        </Text>
      </View>

      <View style={{ padding: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, paddingHorizontal: 14 }}>
          <Feather name="search" size={16} color={PALETTE.gold} />
          <TextInput
            testID="directory-salon-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Salon, ville, quartier..."
            placeholderTextColor={PALETTE.textDim}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 13 }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Feather name="x" size={14} color={PALETTE.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading || search !== query.trim() ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PALETTE.gold} />
        </View>
      ) : isError ? (
        <Pressable onPress={() => refetch()} style={{ padding: 20 }}>
          <Text style={{ color: PALETTE.text }}>Impossible de charger les salons. Réessayer</Text>
        </Pressable>
      ) : (
        <FlatList
          data={list}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={PALETTE.gold} /> : hasNextPage ? (
            <Pressable onPress={() => fetchNextPage()} style={{ padding: 16 }}>
              <Text style={{ color: PALETTE.gold }}>Voir plus de salons</Text>
            </Pressable>
          ) : null}
          keyExtractor={(b) => String(b.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
          ListEmptyComponent={
            <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginTop: 32 }}>
              Aucun salon trouvé.
            </Text>
          }
          renderItem={({ item: b, index: idx }) => (
            <Pressable
              onPress={() => router.push(`/salon/${b.id}` as never)}
              style={{ flexDirection: "row", gap: 14, padding: 14, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.border, alignItems: "center" }}
            >
              <Image source={salonImageSource(b, salonFallbacks[idx % salonFallbacks.length])} style={{ width: 72, height: 72 }} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }} numberOfLines={1}>{b.salonName}</Text>
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
                ) : (
                  <Text style={{ color: PALETTE.gold, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Nouveau</Text>
                )}
              </View>
              <Feather name="chevron-right" size={18} color={PALETTE.gold} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
