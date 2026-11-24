import { useListHomeGalleryPhotos } from "@workspace/api-client-react";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { GalleryLightbox, type LightboxItem } from "@/components/GalleryLightbox";
import { ShimmerImage } from "@/components/ShimmerImage";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { CardRowSkeleton } from "./HomeSkeletons";
import { SectionHeader } from "./SectionHeader";
import { AutoSlidingList } from "./AutoSlidingList";

/** Real home gallery only (no stock fallback). Taps open the lightbox; header opens /gallery. */
export function InspirationSection({ fr }: { fr: boolean }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.round(Math.min(180, (width - 40 - 24) / 2.6));
  const gallery = useListHomeGalleryPhotos();
  const [index, setIndex] = useState<number | null>(null);
  if (gallery.isLoading) return <View style={styles.section}><CardRowSkeleton cardWidth={cardW} aspect={3 / 4} count={4} /></View>;
  const photos = (gallery.data ?? []).slice(0, 12);
  if (gallery.isError || photos.length === 0) return null;
  const items: LightboxItem[] = photos.map((p) => ({ uri: resolveObjectUrl(p.imageUrl, 1200), label: p.caption ?? "" }));
  return (
    <View testID="home-inspiration" style={styles.section}>
      <SectionHeader title={fr ? "Inspiration" : "Inspiration"} action={fr ? "Galerie" : "Gallery"} onPressAction={() => router.push("/gallery")} />
      <AutoSlidingList itemStride={cardW + 12} horizontal data={photos} keyExtractor={(p) => String(p.id)} showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row} snapToInterval={cardW + 12} decelerationRate="fast"
        renderItem={({ item, index: i }) => (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={item.caption || (fr ? `Photo ${i + 1}` : `Photo ${i + 1}`)}
            onPress={() => setIndex(i)} style={({ pressed }) => ({ width: cardW, opacity: pressed ? 0.85 : 1 })}>
            <ShimmerImage source={{ uri: resolveObjectUrl(item.imageUrl, 500) ?? "" }} style={styles.img} contentFit="cover" />
            {!!item.caption && <Typography variant="caption" numberOfLines={1} style={{ marginTop: 6 }}>{item.caption}</Typography>}
          </Pressable>
        )} />
      <GalleryLightbox items={items} initialIndex={index ?? 0} visible={index !== null} onClose={() => setIndex(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  row: { paddingHorizontal: 20, gap: 12 },
  img: { width: "100%", aspectRatio: 3 / 4, borderRadius: 16, overflow: "hidden" },
});
