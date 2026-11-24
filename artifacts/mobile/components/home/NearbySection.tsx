import { Feather } from "@expo/vector-icons";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Card } from "@workspace/zbarber-design/components/native/card";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import type { HomeFavorites } from "@/hooks/home/useHomeFavorites";
import type { NearbyLocation } from "@/hooks/home/useNearbyLocation";
import { CardRowSkeleton } from "./HomeSkeletons";
import { SalonCoverCard, type CoverSalon } from "./SalonCoverCard";
import { SectionHeader } from "./SectionHeader";

export function NearbySection({ location, salons, catalogLoading, catalogError, onRetryCatalog, favorites, cardWidth, fr }: {
  location: NearbyLocation; salons: (CoverSalon & { _km?: number | null })[]; catalogLoading: boolean; catalogError: boolean;
  onRetryCatalog: () => void; favorites: HomeFavorites; cardWidth: number; fr: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  const { permission, position, busy, error, openSettingsOrLocate } = location;
  const title = fr ? "Salons à proximité" : "Nearby salons";
  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View testID="nearby-location-gate" style={styles.section}>
        <SectionHeader title={title} />
        <Card style={styles.gate}>
          <Feather name="crosshair" size={18} color={c.primary} />
          <Typography variant="body" color={c.mutedForeground} style={{ flex: 1 }}>
            {error || (fr ? "Autorisez votre position pour découvrir les salons les plus proches." : "Allow location access to discover the closest salons.")}
          </Typography>
          <Button size="sm" testID="nearby-location-enable" onPress={openSettingsOrLocate} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={c.primaryForeground} /> : (fr ? "Activer" : "Enable")}
          </Button>
        </Card>
      </View>
    );
  }

  const message = (text: string, retry: () => void, testID?: string) => (
    <Card style={styles.gate}>
      <Typography variant="body" color={c.mutedForeground} style={{ flex: 1 }}>{text}</Typography>
      <Button size="sm" variant="outline" testID={testID} onPress={retry}>{fr ? "Réessayer" : "Retry"}</Button>
    </Card>
  );
  return (
    <View testID="nearby-salons-section" style={styles.section}>
      <SectionHeader title={title} action={position ? (fr ? "Actualiser" : "Refresh") : undefined} onPressAction={openSettingsOrLocate} />
      {busy || (position && catalogLoading) ? <CardRowSkeleton cardWidth={cardWidth} />
        : error ? message(error, openSettingsOrLocate, "nearby-location-retry")
        : catalogError ? message(fr ? "Impossible de charger les salons proches." : "Nearby salons couldn't be loaded.", onRetryCatalog)
        : !position ? message(fr ? "Activez votre position pour voir les salons proches." : "Enable location to see nearby salons.", openSettingsOrLocate)
        : salons.length === 0 ? (
          <Typography variant="body" color={c.mutedForeground} style={styles.empty}>
            {fr ? "Aucun salon avec une position enregistrée pour le moment." : "No salons with a saved location yet."}
          </Typography>
        ) : (
          <FlatList horizontal testID="nearby-salons-carousel" data={salons} keyExtractor={(s) => String(s.id)}
            showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} initialNumToRender={3} windowSize={5}
            renderItem={({ item }) => (
              <SalonCoverCard salon={item} width={cardWidth} distanceKm={item._km} fr={fr} testID={`nearby-salon-${item.id}`}
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
  gate: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  empty: { paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: 12 },
});
