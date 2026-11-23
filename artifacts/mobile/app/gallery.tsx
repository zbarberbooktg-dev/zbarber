import { Feather } from "@expo/vector-icons";
import { useListHomeGalleryPhotos } from "@workspace/api-client-react";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { ShimmerImage } from "@/components/ShimmerImage";
import { GalleryLightbox, LightboxItem } from "@/components/GalleryLightbox";
import {
  ActivityIndicator,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveObjectUrl } from "@/lib/imageUpload";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  gold: "#D4AF37",
};

const fallback: { src: ImageSourcePropType; label: string }[] = [
  { src: require("../assets/images/client-home/style1.png"), label: "Le Dégradé" },
  { src: require("../assets/images/client-home/style2.png"), label: "La Barbe" },
  { src: require("../assets/images/client-home/style3.png"), label: "Le Taper" },
  { src: require("../assets/images/client-home/style4.png"), label: "Classique" },
];

export default function HomeGallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useListHomeGalleryPhotos();
  const [lightbox, setLightbox] = useState<{ index: number } | null>(null);

  const items =
    (data && data.length > 0)
      ? data.map((p) => ({
          key: String(p.id),
          uri: resolveObjectUrl(p.imageUrl, 900),
          label: p.caption ?? "",
        }))
      : fallback.map((f, i) => ({ key: `fb-${i}`, src: f.src, uri: null, label: f.label }));

  const lightboxItems: LightboxItem[] = items.map((it) => ({
    uri: it.uri,
    src: (it as any).src,
    label: it.label,
  }));

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
        <Text style={{ color: PALETTE.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>L'Inspiration</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PALETTE.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {items.map((it: any, idx: number) => (
            <Pressable
              key={it.key}
              onPress={() => setLightbox({ index: idx })}
              style={{ marginBottom: 8 }}
            >
              <ShimmerImage
                source={it.uri ? { uri: it.uri } : it.src}
                style={{ width: "100%", aspectRatio: 16 / 11, borderRadius: 18, overflow: "hidden" }}
                contentFit="cover"
              />
              {it.label ? (
                <Text style={{ color: PALETTE.text, marginTop: 8, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{it.label}</Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <GalleryLightbox
        items={lightboxItems}
        initialIndex={lightbox?.index ?? 0}
        visible={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </View>
  );
}
