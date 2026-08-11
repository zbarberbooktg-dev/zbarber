import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type LightboxItem = {
  /** Remote URL – takes priority over src when present. */
  uri?: string | null;
  /** Local require() asset or { uri } object – used when uri is absent. */
  src?: any;
  /** Optional caption shown at the bottom. */
  label?: string;
};

type Props = {
  items: LightboxItem[];
  /** Index to open at. Applied whenever `visible` turns true. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
};

const { width: SW, height: SH } = Dimensions.get("window");
const SWIPE_VX = 400; // px/s horizontal velocity to trigger navigation
const IMG_H = SH * 0.82;

// ── Per-page zoomable photo ──────────────────────────────────────────────────
function ZoomablePhoto({
  item,
  onSwipeLeft,
  onSwipeRight,
}: {
  item: LightboxItem;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        // Snap back to 1 if barely zoomed
        scale.value = withSpring(1, { damping: 20 });
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1.05) {
        // ── Not zoomed: detect horizontal swipe to navigate ──────────────────
        const isHorizontal =
          Math.abs(e.velocityX) > Math.abs(e.velocityY) * 1.2;
        if (isHorizontal && Math.abs(e.velocityX) > SWIPE_VX) {
          if (e.velocityX < 0) runOnJS(onSwipeLeft)();
          else runOnJS(onSwipeRight)();
        }
        return;
      }

      // ── Zoomed: clamp to image bounds ────────────────────────────────────
      const maxTx = (SW * (scale.value - 1)) / 2;
      const maxTy = (IMG_H * (scale.value - 1)) / 2;
      const clampedTx = Math.max(-maxTx, Math.min(maxTx, tx.value));
      const clampedTy = Math.max(-maxTy, Math.min(maxTy, ty.value));

      // Boundary swipe: at the horizontal edge with high velocity → navigate
      const atLeft = tx.value >= maxTx - 4;
      const atRight = tx.value <= -maxTx + 4;

      if (atLeft && e.velocityX > SWIPE_VX) {
        // Pan to left edge, swiping right → go to previous photo
        scale.value = withSpring(1, { damping: 20 });
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(onSwipeRight)();
      } else if (atRight && e.velocityX < -SWIPE_VX) {
        // Pan to right edge, swiping left → go to next photo
        scale.value = withSpring(1, { damping: 20 });
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(onSwipeLeft)();
      } else {
        tx.value = withSpring(clampedTx, { damping: 20 });
        ty.value = withSpring(clampedTy, { damping: 20 });
        savedTx.value = clampedTx;
        savedTy.value = clampedTy;
      }
    });

  // Double-tap: zoom in at 2.5× or reset
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withSpring(1, { damping: 20 });
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withSpring(2.5, { damping: 20 });
        savedScale.value = 2.5;
      }
    });

  // doubleTap races against pinch+pan: first to activate wins
  const composed = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan),
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View
        style={{
          width: SW,
          height: SH,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <Animated.View style={animStyle}>
          <Image
            source={item.uri ? { uri: item.uri } : item.src}
            style={{ width: SW, height: IMG_H }}
            contentFit="contain"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ── Main lightbox modal ───────────────────────────────────────────────────────
export function GalleryLightbox({
  items,
  initialIndex = 0,
  visible,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(initialIndex);
  const flatRef = useRef<FlatList<LightboxItem>>(null);

  // Sync to initialIndex every time the lightbox opens
  useEffect(() => {
    if (!visible || items.length === 0) return;
    const target = Math.max(0, Math.min(initialIndex, items.length - 1));
    setCurrent(target);
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

  const renderItem = ({
    item,
    index,
  }: {
    item: LightboxItem;
    index: number;
  }) => (
    <ZoomablePhoto
      item={item}
      onSwipeLeft={() => goTo(index + 1)}
      onSwipeRight={() => goTo(index - 1)}
    />
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
        {/* ── Swipeable pages (scroll driven manually via goTo) ── */}
        <FlatList
          ref={flatRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: SW,
            offset: SW * index,
            index,
          })}
          initialScrollIndex={Math.max(
            0,
            Math.min(initialIndex, items.length - 1),
          )}
          style={{ flex: 1 }}
        />

        {/* ── Close ── */}
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
