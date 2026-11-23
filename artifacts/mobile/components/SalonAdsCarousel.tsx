import { Feather } from "@expo/vector-icons";
import { getListSalonAdsQueryKey, useListSalonAds, type SalonVideoAd } from "@workspace/api-client-react";
import { useEvent } from "expo";
import { useFocusEffect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ShimmerImage } from "@/components/ShimmerImage";

function AdVideo({ path, fr }: { path: string; fr: boolean }) {
  const c = useColors();
  const player = useVideoPlayer({ uri: apiUrl(path), useCaching: false }, (video) => {
    video.muted = true;
    video.loop = false;
    if (Platform.OS !== "web") video.play();
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    // On web the element is not attached when the player setup callback runs.
    if (Platform.OS === "web" && status === "readyToPlay") player.play();
  }, [player, status]);
  if (status === "error") {
    return <View style={styles.center}><Text style={{ color: c.mutedForeground }}>{fr ? "Vidéo indisponible" : "Video unavailable"}</Text></View>;
  }
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" surfaceType="textureView" />
      {(status === "idle" || status === "loading") && <View pointerEvents="none" style={styles.center}><ActivityIndicator color={c.primary} /></View>}
    </>
  );
}

const viewThreshold = { itemVisiblePercentThreshold: 70 };

export function SalonAdsCarousel({ visible, onLayout }: { visible: boolean; onLayout: (event: LayoutChangeEvent) => void }) {
  const { lang } = useApp();
  const fr = lang === "fr";
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(420, Math.max(200, width - 58));
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active" || AppState.currentState === null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [inView, setInView] = useState<Set<number>>(() => new Set());
  const ads = useListSalonAds({ query: { queryKey: getListSalonAdsQueryKey(), staleTime: 0, refetchOnMount: "always", refetchInterval: focused && foreground ? 30_000 : false, retry: false } });
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void ads.refetch();
    return () => { setFocused(false); setPlayingId(null); };
  }, [ads.refetch]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  const canPlay = visible && focused && foreground;
  useEffect(() => { if (!canPlay) setPlayingId(null); }, [canPlay]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<SalonVideoAd>[] }) => {
    const ids = new Set(viewableItems.filter((i) => i.isViewable).map((i) => i.item.id));
    setInView(ids);
    setPlayingId((id) => id !== null && !ids.has(id) ? null : id);
  }).current;

  if (ads.isError || !ads.data?.length) return null;
  return (
    <View testID="home-salon-ads" onLayout={onLayout} style={{ marginBottom: 24 }}>
      <View style={styles.heading}>
        <Feather name="film" size={17} color={c.primary} />
        <Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }}>
          {fr ? "Salons en vidéo" : "Salons on video"}
        </Text>
      </View>
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
          const eligible = canPlay && inView.has(ad.id);
          const playing = eligible && playingId === ad.id;
          const poster = resolveObjectUrl(ad.posterPath, 720);
          return (
            <View style={[styles.card, { width: cardWidth, borderColor: c.border, backgroundColor: c.card }]}>
              <View style={[styles.media, { backgroundColor: c.muted }]}>
                {playing ? <AdVideo path={ad.videoPath} fr={fr} /> : (
                  <Pressable accessibilityRole="button" accessibilityLabel={fr ? `Lire la vidéo de ${ad.salonName}` : `Play video for ${ad.salonName}`}
                    disabled={!eligible} onPress={() => setPlayingId(ad.id)} style={styles.center}>
                    {poster && <>
                      <ShimmerImage source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.34)" }]} />
                    </>}
                    <View style={[styles.play, { backgroundColor: c.accent }]}><Feather name="play" size={22} color={c.accentForeground} /></View>
                    <Text style={{ color: poster ? "#fff" : c.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{fr ? "Lire la vidéo" : "Play video"}</Text>
                  </Pressable>
                )}
                <View pointerEvents="none" style={[styles.sponsored, { backgroundColor: c.card }]}>
                  <Text style={{ color: c.foreground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{fr ? "Publicité" : "Advertisement"}</Text>
                </View>
                {playing && <Pressable accessibilityRole="button" accessibilityLabel={fr ? "Arrêter la vidéo" : "Stop video"}
                  onPress={() => setPlayingId(null)} style={[styles.stop, { backgroundColor: c.card }]}>
                  <Feather name="x" size={18} color={c.foreground} />
                </Pressable>}
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={fr ? `Voir le salon ${ad.salonName}` : `View salon ${ad.salonName}`}
                onPress={() => { setPlayingId(null); router.push(`/salon/${ad.salonId}`); }}
                style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? c.accent : c.card }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{ad.salonName}</Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 3 }}>{fr ? "Voir le salon" : "View salon"}</Text>
                </View>
                <Feather name="arrow-right" size={20} color={c.primary} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 10 },
  card: { borderRadius: 20, overflow: "hidden", borderWidth: 1 },
  media: { aspectRatio: 16 / 9, overflow: "hidden" },
  center: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", gap: 8 },
  sponsored: { position: "absolute", top: 10, left: 10, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 8 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stop: { position: "absolute", right: 8, top: 8, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cta: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, gap: 8 },
});
