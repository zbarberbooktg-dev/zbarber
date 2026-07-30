import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type LightboxItem = {
  /** Remote URL. If provided, takes priority over src. */
  uri?: string | null;
  /** Local require() asset or { uri } object — used when uri is absent. */
  src?: any;
  /** Optional caption shown at the bottom. */
  label?: string;
};

type Props = {
  items: LightboxItem[];
  /** Index to open at. Changes are applied whenever `visible` turns true. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
};

const { width: SW, height: SH } = Dimensions.get("window");

export function GalleryLightbox({ items, initialIndex = 0, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(initialIndex);
  const flatRef = useRef<FlatList<LightboxItem>>(null);

  // Sync to initialIndex every time the lightbox opens.
  useEffect(() => {
    if (!visible || items.length === 0) return;
    const target = Math.max(0, Math.min(initialIndex, items.length - 1));
    setCurrent(target);
    // Small defer so FlatList is mounted & measured before we scroll.
    const tid = setTimeout(() => {
      flatRef.current?.scrollToIndex({ index: target, animated: false });
    }, 20);
    return () => clearTimeout(tid);
  }, [visible, initialIndex, items.length]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= items.length) return;
    setCurrent(idx);
    flatRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const renderItem = ({ item }: { item: LightboxItem }) => (
    <ScrollView
      style={{ width: SW, height: SH }}
      contentContainerStyle={{
        width: SW,
        minHeight: SH,
        justifyContent: "center",
        alignItems: "center",
      }}
      pinchGestureEnabled
      minimumZoomScale={1}
      maximumZoomScale={5}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      centerContent
    >
      <Image
        source={item.uri ? { uri: item.uri } : item.src}
        style={{ width: SW, height: SH * 0.82 }}
        contentFit="contain"
      />
    </ScrollView>
  );

  const label = items[current]?.label;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* ── Swipeable pages ── */}
        <FlatList
          ref={flatRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
            setCurrent(idx);
          }}
          initialScrollIndex={Math.max(0, Math.min(initialIndex, items.length - 1))}
          style={{ flex: 1 }}
        />

        {/* ── Close button ── */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute",
            top: insets.top + 12,
            right: 20,
            zIndex: 20,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.60)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>

        {/* ── Prev arrow ── */}
        {current > 0 && (
          <Pressable
            onPress={() => goTo(current - 1)}
            hitSlop={12}
            style={{
              position: "absolute",
              left: 16,
              top: SH / 2 - 20,
              zIndex: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.60)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
        )}

        {/* ── Next arrow ── */}
        {current < items.length - 1 && (
          <Pressable
            onPress={() => goTo(current + 1)}
            hitSlop={12}
            style={{
              position: "absolute",
              right: 16,
              top: SH / 2 - 20,
              zIndex: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.60)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="chevron-right" size={24} color="#fff" />
          </Pressable>
        )}

        {/* ── Counter ── */}
        {items.length > 1 && (
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + (label ? 58 : 24),
              alignSelf: "center",
              zIndex: 20,
              backgroundColor: "rgba(0,0,0,0.60)",
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}
            >
              {current + 1} / {items.length}
            </Text>
          </View>
        )}

        {/* ── Caption ── */}
        {!!label && (
          <Text
            style={{
              position: "absolute",
              bottom: insets.bottom + 18,
              alignSelf: "center",
              zIndex: 20,
              color: "#fff",
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              textAlign: "center",
              paddingHorizontal: 28,
            }}
          >
            {label}
          </Text>
        )}
      </View>
    </Modal>
  );
}
