import { useApprovedSalonCatalog, type Barber } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Card } from "@workspace/zbarber-design/components/native/card";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { HomeFavorites } from "@/hooks/home/useHomeFavorites";
import { haversineKm, coordinates, newestRegisteredSalons, type Coordinates } from "@/lib/salonSearch";
import { CardRowSkeleton } from "./HomeSkeletons";
import { SalonCoverCard } from "./SalonCoverCard";
import { SectionHeader } from "./SectionHeader";
import { AutoSlidingList } from "./AutoSlidingList";

type Tab = "new" | "featured";

/** "À découvrir": newest approved + featured salons, or the selected real category. */
export function DiscoverSection({ newest, newestLoading, newestError, onRetryNewest, featured, featuredLoading, featuredError, onRetryFeatured,
  categoryId, categoryName, position, favorites, cardWidth, fr }: {
  newest: Barber[]; newestLoading: boolean; newestError: boolean; onRetryNewest: () => void;
  featured: Barber[]; featuredLoading: boolean; featuredError: boolean; onRetryFeatured: () => void;
  categoryId: number | null; categoryName: string | null; position: Coordinates | null;
  favorites: HomeFavorites; cardWidth: number; fr: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("new");
  // Same catalog hook/keys as the map; with no category it dedupes with the parent's query.
  const category = useApprovedSalonCatalog({ categoryId: categoryId ?? undefined });
  const categorySalons = useMemo(() => categoryId ? newestRegisteredSalons(category.data, 30) : [], [categoryId, category.data]);

  const [items, loading, error, retry] = categoryId
    ? [categorySalons, category.isLoading, category.isError, () => { void category.refetch(); }]
    : tab === "new" ? [newest, newestLoading, newestError, onRetryNewest] : [featured, featuredLoading, featuredError, onRetryFeatured];

  const distanceOf = (s: Barber) => {
    if (!position) return null;
    const p = coordinates(s.latitude, s.longitude);
    return p ? haversineKm(position, p) : null;
  };

  return (
    <View testID="new-salons-section" style={styles.section}>
      <SectionHeader title={categoryName ? categoryName : (fr ? "À découvrir" : "Discover")}
        action={fr ? "Tout voir" : "View all"} onPressAction={() => router.push("/salons" as never)} />
      {!categoryId && (
        <View style={styles.tabs}>
          {(["new", "featured"] as const).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)} testID={`discover-tab-${t}`}>
              {t === "new" ? (fr ? "Nouveaux" : "New") : (fr ? "En vedette" : "Featured")}
            </Button>
          ))}
        </View>
      )}
      {loading ? <CardRowSkeleton cardWidth={cardWidth} /> : error ? (
        <Card style={styles.msg}>
          <Typography variant="body" color={c.mutedForeground} style={{ flex: 1 }}>{fr ? "Impossible de charger ces salons." : "These salons couldn't be loaded."}</Typography>
          <Button size="sm" variant="outline" onPress={retry}>{fr ? "Réessayer" : "Retry"}</Button>
        </Card>
      ) : items.length === 0 ? (
        <Card style={styles.msg}>
          <Typography variant="body" color={c.mutedForeground}>
            {categoryId ? (fr ? "Aucun salon ne propose encore cette catégorie." : "No salon offers this category yet.")
              : (fr ? "Les nouveaux salons validés apparaîtront ici." : "Newly approved salons will appear here.")}
          </Typography>
        </Card>
      ) : (
        <AutoSlidingList itemStride={cardWidth + 12} horizontal testID="new-salons-carousel" data={items} keyExtractor={(s) => String(s.id)}
          showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} initialNumToRender={3} windowSize={5}
          renderItem={({ item }) => (
            <SalonCoverCard salon={item} width={cardWidth} distanceKm={distanceOf(item)} fr={fr} testID={`discover-salon-${item.id}`}
              favorite={favorites.isFavorite(item.id)} favoriteBusy={favorites.busyId === item.id}
              onToggleFavorite={() => { void favorites.toggle(item.id); }}
              onPress={() => router.push(`/salon/${item.id}` as never)} />
          )} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 20, marginBottom: 12, marginTop: -4 },
  row: { paddingHorizontal: 20, gap: 12 },
  msg: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
