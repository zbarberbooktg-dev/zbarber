import { Feather } from "@expo/vector-icons";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiUrl } from "@/lib/api";
import { playWebVideo } from "@/lib/webVideoPlayback";
import { videoStyles as styles } from "./SalonAdVideo.styles";
import type { SalonAdVideoProps } from "./SalonAdVideo.types";

/** Browser media adapter: catches play promises at their source, not globally. */
export function SalonAdVideo({ path, salonName, fr, paused, onTogglePause }: SalonAdVideoProps) {
  const c = useColors(), dark = useColors("dark"), insets = useSafeAreaInsets();
  const video = useRef<HTMLVideoElement>(null);
  const resumeTime = useRef(0);
  const [muted, setMuted] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const palette = expanded ? dark : c;

  const failedToPlay = (error: unknown) => {
    if (error && typeof error === "object" && "name" in error && error.name === "NotAllowedError") setBlocked(true);
    else setFailed(true);
  };
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let current = true;
    if (paused) element.pause();
    else void playWebVideo(element, error => { if (current) failedToPlay(error); });
    return () => { current = false; element.pause(); };
  }, [path, paused, expanded]);
  const changeView = (next: boolean) => {
    resumeTime.current = video.current?.currentTime ?? resumeTime.current;
    setExpanded(next);
  };
  const control = { backgroundColor: palette.background };
  const content = failed ? <View style={styles.center}>
    <Typography variant="label" color={palette.foreground}>{fr ? "Vidéo indisponible" : "Video unavailable"}</Typography>
  </View> : <>
    <video ref={video} src={apiUrl(path)} muted={muted} loop playsInline preload="metadata" tabIndex={-1}
      aria-label={salonName} style={{ position: "absolute", width: "100%", height: "100%", objectFit: expanded ? "contain" : "cover" }}
      onCanPlay={() => setReady(true)} onError={() => setFailed(true)}
      onLoadedMetadata={() => {
        const element = video.current;
        if (element && resumeTime.current > 0) element.currentTime = Number.isFinite(element.duration)
          ? Math.min(resumeTime.current, element.duration) : resumeTime.current;
      }} />
    {!expanded && <Pressable testID="ad-expand-video" accessibilityRole="button"
      accessibilityLabel={fr ? "Agrandir la vidéo" : "Enlarge video"}
      onPress={() => changeView(true)} style={StyleSheet.absoluteFill}>
      <View style={[styles.ctl, styles.bl, control]}><Feather name="maximize-2" size={15} color={palette.foreground} /></View>
    </Pressable>}
    {!ready && <View pointerEvents="none" style={styles.center}><ActivityIndicator color={palette.primary} /></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={paused || blocked
      ? (fr ? "Reprendre la publicité" : "Resume advertisement") : (fr ? "Mettre la publicité en pause" : "Pause advertisement")}
      onPress={() => {
        if (blocked && !paused && video.current) {
          setBlocked(false); void playWebVideo(video.current, failedToPlay);
        } else onTogglePause();
      }} style={[styles.ctl, styles.tr, control]}>
      <Feather name={paused || blocked ? "play" : "pause"} size={15} color={palette.foreground} />
    </Pressable>
    {ready && <Pressable testID="ad-toggle-sound" accessibilityRole="button"
      accessibilityLabel={muted ? (fr ? "Activer le son" : "Turn sound on") : (fr ? "Couper le son" : "Mute")}
      accessibilityState={{ selected: !muted }} onPress={() => setMuted(value => !value)}
      style={[styles.ctl, styles.br, control]}>
      <Feather name={muted ? "volume-x" : "volume-2"} size={15} color={palette.foreground} />
    </Pressable>}
  </>;
  if (!expanded) return content;
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => changeView(false)}>
    <View testID="ad-expanded-video" style={[styles.expanded, { backgroundColor: dark.background,
      paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(12, insets.bottom) }]}>
      <View style={styles.header}>
        <Typography variant="subtitle" accessibilityRole="header" numberOfLines={1} color={dark.foreground} style={{ flex: 1 }}>{salonName}</Typography>
        <Pressable testID="ad-close-expanded-video" accessibilityRole="button"
          accessibilityLabel={fr ? "Fermer la vidéo agrandie" : "Close enlarged video"}
          onPress={() => changeView(false)} style={[styles.close, { backgroundColor: dark.card }]}>
          <Feather name="x" size={20} color={dark.foreground} />
        </Pressable>
      </View>
      <View style={styles.media}>{content}</View>
    </View>
  </Modal>;
}
