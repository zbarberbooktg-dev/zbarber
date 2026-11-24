import { Feather } from "@expo/vector-icons";
import { getListSalonAdsQueryKey, useListSalonAds, type SalonVideoAd } from "@workspace/api-client-react";
import { useEvent } from "expo";
import { useFocusEffect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ShimmerImage } from "@/components/ShimmerImage";

function AdVideo({ path, salonName, fr, paused, onTogglePause }: {
  path: string; salonName: string; fr: boolean; paused: boolean; onTogglePause: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const webResumeTime = useRef<number | null>(null);
  const player = useVideoPlayer({ uri: apiUrl(path), useCaching: false }, (video) => {
    video.muted = false;
    video.loop = true;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const readyForPlayback = Platform.OS !== "web" || status === "readyToPlay";
  useEffect(() => {
    if (paused) player.pause();
    // On web, wait for the HTML video to attach and become ready.
    else if (readyForPlayback) player.play();
  }, [player, paused, readyForPlayback]);
  const changeView = (next: boolean) => {
    // Native views attach to the same player. Web replaces the video element.
    if (Platform.OS === "web" && webResumeTime.current === null) webResumeTime.current = player.currentTime;
    setExpanded(next);
  };
  const onFirstFrame = () => {
    if (Platform.OS !== "web" || webResumeTime.current === null) return;
    const time = webResumeTime.current;
    webResumeTime.current = null;
    if (Number.isFinite(time) && time > 0) player.currentTime = time;
    if (paused) player.pause();
    else player.play();
  };
  const controlsBackground = { backgroundColor: c.card };
  const content = status === "error" ? (
    <View style={styles.center}><Text style={{ color: expanded ? "#fff" : c.foreground }}>{fr ? "Vidéo indisponible" : "Video unavailable"}</Text></View>
  ) : (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} playsInline contentFit="contain"
        surfaceType="textureView" onFirstFrameRender={onFirstFrame} />
      {!expanded && <Pressable testID="ad-expand-video" accessibilityRole="button"
        accessibilityLabel={fr ? "Agrandir la vidéo" : "Enlarge video"}
        onPress={() => changeView(true)} style={StyleSheet.absoluteFill}>
        <View style={[styles.expand, controlsBackground]}>
          <Feather name="maximize-2" size={17} color={c.foreground} />
        </View>
      </Pressable>}
      {(status === "idle" || status === "loading") && <View pointerEvents="none" style={styles.center}><ActivityIndicator color={c.primary} /></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={paused
        ? (fr ? "Reprendre la publicité" : "Resume advertisement")
        : (fr ? "Mettre la publicité en pause" : "Pause advertisement")}
        onPress={onTogglePause} style={[styles.stop, controlsBackground]}>
        <Feather name={paused ? "play" : "pause"} size={18} color={c.foreground} />
      </Pressable>
      {status === "readyToPlay" && (
        <Pressable testID="ad-toggle-sound" accessibilityRole="button"
          accessibilityLabel={muted ? (fr ? "Activer le son" : "Turn sound on") : (fr ? "Couper le son" : "Mute")}
          accessibilityState={{ selected: !muted }}
          onPress={() => {
            const next = !player.muted;
            player.muted = next;
            setMuted(next);
          }}
          style={({ pressed }) => [styles.sound, controlsBackground, { opacity: pressed ? 0.85 : 1 }]}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={17} color={c.foreground} />
        </Pressable>
      )}
    </>
  );
  if (!expanded) return content;
  const close = () => changeView(false);
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <View testID="ad-expanded-video" style={[styles.expanded, {
        paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(12, insets.bottom),
        paddingLeft: insets.left, paddingRight: insets.right,
      }]}>
        <View style={styles.expandedHeader}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.expandedTitle}>{salonName}</Text>
          <Pressable testID="ad-close-expanded-video" accessibilityRole="button"
            accessibilityLabel={fr ? "Fermer la vidéo agrandie" : "Close enlarged video"}
            onPress={close} style={[styles.close, controlsBackground]}>
            <Feather name="x" size={21} color={c.foreground} />
          </Pressable>
        </View>
        <View style={styles.expandedMedia}>{content}</View>
      </View>
    </Modal>
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
    const ids = new Set(viewableItems.filter((i) => i.isViewable).map((i) => i.item.id));
    setInView(ids);
  }).current;

  if (ads.isError || !ads.data?.length) return null;
  const visibleAdId = ads.data.find((ad) => inView.has(ad.id))?.id;
  const setPaused = (id: number, paused: boolean) => setPausedIds((old) => {
    const next = new Set(old);
    if (paused) next.add(id);
    else next.delete(id);
    return next;
  });
  return (
    <View testID="home-salon-ads" onLayout={onLayout} style={{ marginBottom: 24 }}>
      <View style={styles.heading}>
        <Feather name="film" size={17} color={c.primary} />
        <Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }}>
          {fr ? "Salon du mois" : "Salon of the month"}
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
          const eligible = canPlay && visibleAdId === ad.id;
          const playing = eligible && !pausedIds.has(ad.id);
          const poster = resolveObjectUrl(ad.posterPath, 720);
          return (
            <View style={{ width: cardWidth }}>
              <View style={[styles.media, { backgroundColor: c.muted }]}>
                {eligible ? <AdVideo key={ad.videoPath} path={ad.videoPath} salonName={ad.salonName}
                  fr={fr} paused={!playing} onTogglePause={() => setPaused(ad.id, playing)} /> : (
                  <View style={styles.center}>
                    {poster && <>
                      <ShimmerImage source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.34)" }]} />
                    </>}
                    <View style={[styles.play, { backgroundColor: c.accent }]}><Feather name="film" size={22} color={c.accentForeground} /></View>
                    <Text style={{ color: poster ? "#fff" : c.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{fr ? "Vidéo du salon" : "Salon video"}</Text>
                  </View>
                )}
                <View pointerEvents="none" style={[styles.sponsored, { backgroundColor: c.card }]}>
                  <Text style={{ color: c.foreground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{fr ? "Publicité" : "Advertisement"}</Text>
                </View>
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={fr ? `Voir le salon ${ad.salonName}` : `View salon ${ad.salonName}`}
                onPress={() => router.push(`/salon/${ad.salonId}`)}
                style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}>
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
  media: { aspectRatio: 16 / 9, borderRadius: 20, overflow: "hidden" },
  center: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", gap: 8 },
  sponsored: { position: "absolute", top: 10, left: 10, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 8 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stop: { position: "absolute", right: 8, top: 8, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  expand: { position: "absolute", left: 8, bottom: 8, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sound: { position: "absolute", right: 8, bottom: 8, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  expanded: { flex: 1, backgroundColor: "#000" },
  expandedHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 6 },
  expandedTitle: { flex: 1, color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  expandedMedia: { flex: 1, backgroundColor: "#000" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cta: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingVertical: 7, paddingHorizontal: 2, gap: 8 },
});
