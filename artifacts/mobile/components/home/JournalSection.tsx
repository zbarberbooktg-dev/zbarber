import { useListPublicArticles } from "@workspace/api-client-react";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ShimmerImage } from "@/components/ShimmerImage";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ListSkeleton } from "./HomeSkeletons";
import { SectionHeader } from "./SectionHeader";

/** Published articles only; the section disappears when there are none. */
export function JournalSection({ fr }: { fr: boolean }) {
  const c = useColors();
  const router = useRouter();
  const articles = useListPublicArticles();
  if (articles.isLoading) return <View style={styles.section}><ListSkeleton rows={2} /></View>;
  if (articles.isError || !articles.data?.length) return null;
  return (
    <View testID="home-journal" style={styles.section}>
      <SectionHeader title={fr ? "Journal Zbarber" : "Zbarber Journal"} />
      <View style={styles.list}>
        {articles.data.slice(0, 4).map((a) => (
          <Pressable key={a.id} accessibilityRole="link" accessibilityLabel={a.title}
            onPress={() => router.push(`/articles/${a.id}` as never)}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.8 : 1 }]}>
            <ShimmerImage source={{ uri: resolveObjectUrl(a.coverImageUrl, 360) ?? "" }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="title" numberOfLines={2} style={{ fontSize: 17, lineHeight: 22 }}>{a.title}</Typography>
              {!!a.subtitle && <Typography variant="caption" color={c.mutedForeground} numberOfLines={2}>{a.subtitle}</Typography>}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  list: { paddingHorizontal: 20, gap: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: { width: 104, aspectRatio: 4 / 3, borderRadius: 14, overflow: "hidden" },
});
