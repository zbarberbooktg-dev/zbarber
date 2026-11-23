import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useRef, useState } from "react";
import {
  FlatList,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { ShimmerImage } from "@/components/ShimmerImage";

export type SalonSlide = { key: string; source: ImageSourcePropType };

type Props = {
  slides: SalonSlide[];
  isGallery: boolean;
  isFr: boolean;
  worksLabel?: string;
  colors: { bg: string; surface: string; border: string; text: string; textMuted: string; gold: string };
  onOpen: (index: number) => void;
};

export function SalonPhotoGallery({ slides, isGallery, isFr, worksLabel, colors: C, onOpen }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<SalonSlide>>(null);

  const width = w || Math.min(winW, 900);
  // Taller than the old landscape crop, capped to leave room for salon details.
  const height = Math.round(Math.min(width * 1.05, winH * 0.62, 640));
  const multi = slides.length > 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < slides.length) setIndex(i);
  };

  const select = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToOffset({ offset: i * width, animated: true });
  };

  return (
    <View
      style={{ width: "100%", maxWidth: 900, alignSelf: "center", backgroundColor: C.bg }}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      testID="salon-photo-gallery"
    >
      <View style={{ width, height, backgroundColor: C.surface }}>
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(it) => it.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          extraData={width}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <Pressable
              onPress={() => onOpen(i)}
              testID={`salon-photo-${i}`}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                isFr ? `Agrandir la photo ${i + 1} sur ${slides.length}` : `Open photo ${i + 1} of ${slides.length}`
              }
            >
              <ShimmerImage
                source={item.source}
                style={{ width, height }}
                contentFit="contain"
                transition={200}
                shimmerBase={C.surface}
                shimmerHighlight={C.border}
              />
            </Pressable>
          )}
        />
      </View>

      {/* Caption row, below the photo */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: multi ? 8 : 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name={isGallery ? "image" : "home"} size={13} color={C.gold} />
          <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 0.3 }}>
            {isGallery
              ? `${worksLabel ?? (isFr ? "Réalisations" : "Works")} · ${slides.length}`
              : isFr ? "Photo du salon" : "Salon photo"}
          </Text>
        </View>
        <Pressable
          onPress={() => onOpen(index)}
          hitSlop={8}
          testID="salon-photo-expand"
          accessibilityRole="button"
          accessibilityLabel={isFr ? "Voir en plein écran" : "View full screen"}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          {multi && (
            <Text style={{ color: C.textMuted, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              {index + 1} / {slides.length}
            </Text>
          )}
          <Feather name="maximize-2" size={14} color={C.textMuted} />
        </Pressable>
      </View>

      {multi && (
        <FlatList
          data={slides}
          keyExtractor={(it) => `thumb-${it.key}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}
          renderItem={({ item, index: i }) => {
            const active = i === index;
            return (
              <Pressable
                onPress={() => select(i)}
                testID={`salon-photo-thumb-${i}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={isFr ? `Afficher la photo ${i + 1}` : `Show photo ${i + 1}`}
                style={{
                  width: 64, height: 64, borderRadius: 10, overflow: "hidden",
                  borderWidth: 2, borderColor: active ? C.gold : C.border,
                  opacity: active ? 1 : 0.6, backgroundColor: C.surface,
                }}
              >
                <Image source={item.source} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
