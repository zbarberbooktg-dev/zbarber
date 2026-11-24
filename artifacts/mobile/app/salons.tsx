import { Feather } from "@expo/vector-icons";
import { getListSalonCatalogLocationsQueryKey, listBarbers, useListSalonCatalogLocations } from "@workspace/api-client-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SalonCatalogFilters, type CatalogFilter } from "@/components/SalonCatalogFilters";
import { SalonListRow } from "@/components/SalonListRow";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { coordinates, haversineKm } from "@/lib/salonSearch";

export default function AllSalons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { lang } = useApp();
  const fr = lang === "fr";
  const params = useLocalSearchParams<{ search?: string }>();
  const [query, setQuery] = useState(params.search ?? "");
  const [search, setSearch] = useState(query.trim());
  const [filter, setFilter] = useState<CatalogFilter>({});
  useEffect(() => { setQuery(params.search ?? ""); }, [params.search]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const locations = useListSalonCatalogLocations({ query: { queryKey: getListSalonCatalogLocationsQueryKey(), staleTime: 30_000 } });
  const filters = {
    status: "approved" as const, search: search || undefined,
    country: filter.country, city: filter.city,
    minPrice: filter.minPrice, maxPrice: filter.maxPrice,
    radiusKm: filter.radiusKm, latitude: filter.origin?.lat, longitude: filter.origin?.lng,
  };
  const { data, isLoading, isError, isFetchingNextPage, isFetchNextPageError, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["/api/barbers", "directory", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listBarbers({ ...filters, limit: 20, page: pageParam }, { signal }),
    getNextPageParam: (page) => page.page * page.limit < page.total ? page.page + 1 : undefined,
    staleTime: 30000, refetchOnMount: "always",
  });
  const searching = isLoading || search !== query.trim();
  const catalogError = isError && !data;
  const total = data?.pages[0]?.total ?? 0;
  const list = searching || catalogError ? [] : Array.from(new Map(data?.pages.flatMap((page) => page.data.map((salon) => [salon.id, salon] as const))).values());
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable accessibilityRole="button" accessibilityLabel={fr ? "Retour" : "Go back"} onPress={() => router.canGoBack() ? router.back() : router.replace("/browse")}
          style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Text accessibilityRole="header" style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
          {fr ? "Catalogue des salons" : "Salon directory"}
        </Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(b) => String(b.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(28, insets.bottom + 16) }}
        ListHeaderComponent={<View style={{ paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: 15, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 13 }}>
            <Feather name="search" size={16} color={c.primary} />
            <TextInput testID="directory-salon-search" value={query} onChangeText={setQuery} maxLength={200}
              accessibilityLabel={fr ? "Rechercher un salon" : "Search for a salon"}
              placeholder={fr ? "Salon, ville, quartier…" : "Salon, city, neighbourhood…"}
              placeholderTextColor={c.mutedForeground}
              style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, color: c.foreground, fontSize: 14 }} />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel={fr ? "Effacer la recherche" : "Clear search"} onPress={() => setQuery("")} hitSlop={10}>
              <Feather name="x" size={17} color={c.mutedForeground} />
            </Pressable>}
          </View>
          <SalonCatalogFilters filter={filter} onChange={setFilter} locations={locations.data ?? []}
            locationError={locations.isError} onRetry={() => void locations.refetch()} fr={fr} />
          {!searching && !catalogError && <Text accessibilityLiveRegion="polite" style={{ color: c.mutedForeground, marginTop: 14, fontSize: 13 }}>
            {total} {total === 1 ? (fr ? "salon trouvé" : "salon found") : (fr ? "salons trouvés" : "salons found")}
          </Text>}
        </View>}
        onEndReached={() => { if (!searching && !isError && hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={searching ? <ActivityIndicator style={{ marginTop: 22 }} color={c.primary} /> : catalogError ? (
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={{ paddingVertical: 16 }}>
            <Text style={{ color: c.primary }}>{fr ? "Impossible de charger les salons. Réessayer." : "Could not load salons. Retry."}</Text>
          </Pressable>
        ) : <Text style={{ color: c.mutedForeground, marginTop: 12 }}>{fr ? "Aucun salon ne correspond à vos critères." : "No salons match your filters."}</Text>}
        ListFooterComponent={searching || catalogError ? null : isFetchingNextPage ? <ActivityIndicator color={c.primary} /> : hasNextPage ? (
          <Pressable accessibilityRole="button" onPress={() => void fetchNextPage()} style={{ paddingVertical: 16 }}>
            <Text style={{ color: c.primary }}>{isFetchNextPageError
              ? (fr ? "Impossible de charger la suite. Réessayer." : "Could not load more salons. Retry.")
              : (fr ? "Voir plus de salons" : "Load more salons")}</Text>
          </Pressable>
        ) : null}
        renderItem={({ item }) => {
          const point = coordinates(item.latitude, item.longitude);
          const km = filter.origin && point ? haversineKm(filter.origin, point) : undefined;
          const distance = km === undefined ? undefined : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString(fr ? "fr" : "en", { maximumFractionDigits: 1 })} km`;
          return <SalonListRow salon={item} showCountry distance={distance} onPress={() => router.push(`/salon/${item.id}`)} />;
        }}
      />
    </KeyboardAvoidingView>
  );
}
