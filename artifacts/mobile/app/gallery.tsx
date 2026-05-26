import { Feather } from "@expo/vector-icons";
import { useListHomeGalleryPhotos } from "@workspace/api-client-react";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
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

  const items =
    (data && data.length > 0)
      ? data.map((p) => ({
          key: String(p.id),
          uri: resolveObjectUrl(p.imageUrl),
          label: p.caption ?? "",
        }))
      : fallback.map((f, i) => ({ key: `fb-${i}`, src: f.src, uri: null, label: f.label }));

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
          {items.map((it: any) => (
            <View key={it.key} style={{ aspectRatio: 16 / 11, borderWidth: 1, borderColor: PALETTE.border, overflow: "hidden", position: "relative" }}>
              <Image
                source={it.uri ? { uri: it.uri } : it.src}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              {it.label ? (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: "rgba(0,0,0,0.55)" }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{it.label}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
