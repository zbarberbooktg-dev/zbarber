import { Feather } from "@expo/vector-icons";
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { getGetPublicArticleQueryKey, useGetPublicArticle } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RenderHTML from "react-native-render-html";

import { resolveObjectUrl } from "@/lib/imageUpload";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  border: "#2A2A2A",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  gold: "#D4AF37",
};

export default function ArticleDetail() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, isLoading, error } = useGetPublicArticle(id, {
    query: {
      queryKey: getGetPublicArticleQueryKey(id),
      enabled: Number.isFinite(id) && id > 0,
    },
  });
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
  });
  const serif = fontsLoaded ? "PlayfairDisplay_500Medium" : "Inter_700Bold";
  const serifBold = fontsLoaded ? "PlayfairDisplay_600SemiBold" : "Inter_700Bold";
  const serifItalic = fontsLoaded ? "PlayfairDisplay_400Regular_Italic" : "Inter_400Regular";

  const htmlSource = useMemo(
    () => ({ html: data?.contentHtml || "<p></p>" }),
    [data?.contentHtml],
  );

  const tagsStyles = useMemo(
    () => ({
      body: { color: PALETTE.text, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 24 },
      p: { marginBottom: 14 },
      h1: { color: "#fff", fontFamily: serifBold, fontSize: 26, marginTop: 18, marginBottom: 10 },
      h2: { color: "#fff", fontFamily: serifBold, fontSize: 22, marginTop: 16, marginBottom: 10 },
      h3: { color: "#fff", fontFamily: serif, fontSize: 18, marginTop: 14, marginBottom: 8 },
      a: { color: PALETTE.gold, textDecorationLine: "underline" as const },
      strong: { color: "#fff", fontWeight: "700" as const },
      em: { fontStyle: "italic" as const },
      blockquote: {
        borderLeftWidth: 2,
        borderLeftColor: PALETTE.gold,
        paddingLeft: 14,
        marginVertical: 12,
        color: PALETTE.textMuted,
        fontStyle: "italic" as const,
      },
      ul: { marginBottom: 14, paddingLeft: 8 },
      ol: { marginBottom: 14, paddingLeft: 8 },
      li: { color: PALETTE.text, marginBottom: 6 },
    }),
    [serif, serifBold],
  );

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular" }}>Article introuvable</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={PALETTE.gold} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bg, paddingTop: insets.top + 60, paddingHorizontal: 24 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ position: "absolute", top: insets.top + 12, left: 16, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontFamily: serif, fontSize: 22, marginTop: 24 }}>Article indisponible</Text>
        <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
          Cet article n'existe pas ou n'est plus disponible.
        </Text>
      </View>
    );
  }

  const formattedDate = new Date(data.startsAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: resolveObjectUrl(data.coverImageUrl) ?? "" }}
            style={{ width: "100%", aspectRatio: 4 / 3 }}
            resizeMode="cover"
          />
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,0.35)" }} />
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ position: "absolute", top: insets.top + 12, left: 16, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: PALETTE.gold, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14 }}>
            <Text style={{ color: "#000", fontSize: 10, letterSpacing: 1.5, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>
              L'Édito
            </Text>
          </View>

          <Text style={{ color: "#fff", fontFamily: serifBold, fontSize: 28, lineHeight: 34 }}>
            {data.title}
          </Text>

          {data.subtitle ? (
            <Text style={{ color: PALETTE.textMuted, fontFamily: serifItalic, fontSize: 17, lineHeight: 24, marginTop: 10 }}>
              {data.subtitle}
            </Text>
          ) : null}

          <Text style={{ color: PALETTE.textMuted, fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 14 }}>
            {formattedDate}
          </Text>

          <View style={{ height: 1, backgroundColor: PALETTE.border, marginVertical: 20 }} />

          <RenderHTML
            contentWidth={width - 48}
            source={htmlSource}
            tagsStyles={tagsStyles}
            defaultTextProps={{ selectable: true }}
            enableExperimentalMarginCollapsing
          />
        </View>
      </ScrollView>
    </View>
  );
}
