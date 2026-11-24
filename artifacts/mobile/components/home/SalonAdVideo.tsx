import { Feather } from "@expo/vector-icons";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiUrl } from "@/lib/api";
import { videoStyles as styles } from "./SalonAdVideo.styles";
import type { SalonAdVideoProps } from "./SalonAdVideo.types";

/** Native player; Metro selects the HTML media adapter only for web. */
export function SalonAdVideo({ path, salonName, fr, paused, onTogglePause }: SalonAdVideoProps) {
  const c = useColors(), dark = useColors("dark");
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const player = useVideoPlayer({ uri: apiUrl(path), useCaching: false }, video => {
    video.muted = false;
    video.loop = true;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [player, paused]);
  const palette = expanded ? dark : c;
  const control = { backgroundColor: palette.background };
  const content = status === "error" ? (
    <View style={styles.center}><Typography variant="label" color={palette.foreground}>
      {fr ? "Vidéo indisponible" : "Video unavailable"}
    </Typography></View>
  ) : <>
    <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} playsInline
      contentFit={expanded ? "contain" : "cover"} surfaceType="textureView" />
    {!expanded && <Pressable testID="ad-expand-video" accessibilityRole="button"
      accessibilityLabel={fr ? "Agrandir la vidéo" : "Enlarge video"}
      onPress={() => setExpanded(true)} style={StyleSheet.absoluteFill}>
      <View style={[styles.ctl, styles.bl, control]}><Feather name="maximize-2" size={15} color={palette.foreground} /></View>
    </Pressable>}
    {(status === "idle" || status === "loading") && <View pointerEvents="none" style={styles.center}><ActivityIndicator color={palette.primary} /></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={paused ? (fr ? "Reprendre la publicité" : "Resume advertisement")
      : (fr ? "Mettre la publicité en pause" : "Pause advertisement")}
      onPress={onTogglePause} style={[styles.ctl, styles.tr, control]}>
      <Feather name={paused ? "play" : "pause"} size={15} color={palette.foreground} />
    </Pressable>
    {status === "readyToPlay" && <Pressable testID="ad-toggle-sound" accessibilityRole="button"
      accessibilityLabel={muted ? (fr ? "Activer le son" : "Turn sound on") : (fr ? "Couper le son" : "Mute")}
      accessibilityState={{ selected: !muted }}
      onPress={() => { const next = !player.muted; player.muted = next; setMuted(next); }}
      style={[styles.ctl, styles.br, control]}>
      <Feather name={muted ? "volume-x" : "volume-2"} size={15} color={palette.foreground} />
    </Pressable>}
  </>;
  if (!expanded) return content;
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setExpanded(false)}>
    <View testID="ad-expanded-video" style={[styles.expanded, { backgroundColor: dark.background,
      paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(12, insets.bottom), paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        <Typography variant="subtitle" color={dark.foreground} accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>{salonName}</Typography>
        <Pressable testID="ad-close-expanded-video" accessibilityRole="button"
          accessibilityLabel={fr ? "Fermer la vidéo agrandie" : "Close enlarged video"}
          onPress={() => setExpanded(false)} style={[styles.close, { backgroundColor: dark.card }]}>
          <Feather name="x" size={20} color={dark.foreground} />
        </Pressable>
      </View>
      <View style={styles.media}>{content}</View>
    </View>
  </Modal>;
}
