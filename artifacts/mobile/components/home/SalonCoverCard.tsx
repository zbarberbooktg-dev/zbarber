import { Feather } from "@expo/vector-icons";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SalonCardImage } from "@/components/SalonCardImage";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

export type CoverSalon = {
  id: number; salonName: string; logoUrl?: string | null; cardImageUrl?: string | null;
  neighborhood?: string | null; city?: string | null; rating?: number | null; reviewCount?: number;
};

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Compact 4:3 salon cover. The favorite toggle is a SIBLING of the card
 * pressable (absolutely positioned over the photo), never nested inside it.
 */
export function SalonCoverCard({ salon, width, distanceKm, favorite, favoriteBusy, onToggleFavorite, onPress, fr, testID }: {
  salon: CoverSalon; width: number; distanceKm?: number | null; favorite: boolean; favoriteBusy: boolean;
  onToggleFavorite: () => void; onPress: () => void; fr: boolean; testID?: string;
}) {
  const c = useColors();
  const place = [salon.neighborhood, salon.city].filter(Boolean).join(" · ");
  const rating = salon.rating && Number(salon.rating) > 0 ? Number(salon.rating) : null;
  const distance = distanceKm != null ? formatDistance(distanceKm) : null;
  return (
    <View style={{ width }} testID={testID}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={[salon.salonName, place, distance, rating ? `${rating.toFixed(1)} / 5` : null].filter(Boolean).join(", ")}
        onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <SalonCardImage salon={salon} imageWidth={420} iconSize={22} style={styles.cover} />
        <View style={styles.meta}>
          <Typography variant="subtitle" numberOfLines={1} style={styles.name}>{salon.salonName}</Typography>
          {!!place && <Typography variant="caption" color={c.mutedForeground} numberOfLines={1}>{place}</Typography>}
          {(!!rating || !!distance) && (
            <View style={styles.facts}>
              {!!rating && (
                <View style={styles.fact}>
                  <Feather name="star" size={11} color={c.primary} />
                  <Typography variant="caption">{rating.toFixed(1)}{salon.reviewCount ? ` (${salon.reviewCount})` : ""}</Typography>
                </View>
              )}
              {!!distance && (
                <View style={styles.fact}>
                  <Feather name="navigation" size={10} color={c.mutedForeground} />
                  <Typography variant="caption" color={c.mutedForeground}>{distance}</Typography>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
      <Pressable testID={testID ? `${testID}-favorite` : undefined} onPress={onToggleFavorite} disabled={favoriteBusy}
        accessibilityRole="button" accessibilityState={{ selected: favorite, busy: favoriteBusy }}
        accessibilityLabel={fr ? (favorite ? `Retirer ${salon.salonName} des favoris` : `Ajouter ${salon.salonName} aux favoris`)
          : (favorite ? `Remove ${salon.salonName} from favorites` : `Add ${salon.salonName} to favorites`)}
        hitSlop={4} style={[styles.fav, { backgroundColor: c.background }]}>
        {favoriteBusy ? <ActivityIndicator size="small" color={c.primary} />
          : <Feather name="heart" size={15} color={favorite ? c.primary : c.foreground} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden" },
  meta: { paddingTop: 8, paddingHorizontal: 2, gap: 2 },
  name: { fontSize: 15, lineHeight: 20 },
  facts: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  fact: { flexDirection: "row", alignItems: "center", gap: 4 },
  fav: { position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: 0.92 },
});
