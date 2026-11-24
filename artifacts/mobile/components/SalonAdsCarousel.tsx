import { Feather } from "@expo/vector-icons";
import { getListSalonAdsQueryKey, useListSalonAds, type SalonVideoAd } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ShimmerImage } from "@/components/ShimmerImage";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SalonAdVideo } from "@/components/home/SalonAdVideo";

const viewThreshold = { itemVisiblePercentThreshold: 70 };

/** "Salon du mois": compact editorial banner. Only one on-screen ad ever plays. */
export function SalonAdsCarousel({ visible, onLayout }: { visible: boolean; onLayout: (event: LayoutChangeEvent) => void }) {
  const { lang } = useApp();
  const fr = lang === "fr";
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(460, Math.max(220, width - 40));
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active" || AppState.currentState === null);
  const [pausedIds, setPausedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [inView, setInView] = useState<Set<number>>(() => new Set());
  const ads = useListSalonAds({ query: { queryKey: getListSalonAdsQueryKey(), staleTime: 0, refetchOnMount: "always", refetchInterval: focused && foreground ? 30_000 : false, retry: false } });
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void ads.refetch();
    return () => { setFocused(false); };
  }, [ads.refetch]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  const canPlay = visible && focused && foreground;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<SalonVideoAd>[] }) => {
    setInView(new Set(viewableItems.filter((i) => i.isViewable).map((i) => i.item.id)));
  }).current;

  if (ads.isError || !ads.data?.length) return null;
  const visibleAdId = ads.data.find((ad) => inView.has(ad.id))?.id;
  const setPaused = (id: number, paused: boolean) => setPausedIds((old) => {
    const next = new Set(old);
    if (paused) next.add(id); else next.delete(id);
    return next;
  });
  return (
    <View testID="home-salon-ads" onLayout={onLayout} style={{ marginBottom: 28 }}>
      <SectionHeader title={fr ? "Salon du mois" : "Salon of the month"}
        icon={<Feather name="film" size={16} color={c.isDark ? c.primary : c.ring} />} />
      <FlatList
        data={ads.data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(ad) => String(ad.id)}
        viewabilityConfig={viewThreshold}
        onViewableItemsChanged={onViewableItemsChanged}
        contentContainerStyle={styles.list}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        renderItem={({ item: ad }) => {
          const eligible = canPlay && visibleAdId === ad.id;
          const playing = eligible && !pausedIds.has(ad.id);
          const poster = resolveObjectUrl(ad.posterPath, 720);
          return (
            <View style={{ width: cardWidth }}>
              <View style={[styles.media, { backgroundColor: c.card }]}>
                {eligible ? <SalonAdVideo key={ad.videoPath} path={ad.videoPath} salonName={ad.salonName}
                  fr={fr} paused={!playing} onTogglePause={() => setPaused(ad.id, playing)} /> : (
                  <View style={styles.center}>
                    {poster
                      ? <ShimmerImage source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      : <Feather name="film" size={22} color={c.mutedForeground} />}
                  </View>
                )}
                <View pointerEvents="none" style={[styles.sponsored, { backgroundColor: c.background }]}>
                  <Typography variant="caption" style={{ fontSize: 10, lineHeight: 13 }}>{fr ? "Sponsorisé" : "Sponsored"}</Typography>
                </View>
              </View>
              <View style={styles.cta}>
                <Typography variant="subtitle" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>{ad.salonName}</Typography>
                <Button variant="ghost" size="sm" onPress={() => router.push(`/salon/${ad.salonId}`)}
                  accessibilityLabel={fr ? `Découvrir le salon ${ad.salonName}` : `Discover salon ${ad.salonName}`}>
                  {fr ? "Découvrir" : "Discover"}
                </Button>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 },
  media: { aspectRatio: 2.35, borderRadius: 16, overflow: "hidden" },
  center: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  sponsored: { position: "absolute", top: 8, left: 8, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 7, opacity: 0.9 },
  cta: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, paddingLeft: 2 },
});
