import { LinearGradient } from "expo-linear-gradient";
import { Image, ImageProps } from "expo-image";
import React, { useRef, useEffect, useState } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface ShimmerImageProps extends Omit<ImageProps, "style"> {
  style?: StyleProp<ViewStyle>;
  shimmerBase?: string;
  shimmerHighlight?: string;
}

export function ShimmerImage({
  style,
  onLoad,
  shimmerBase = "#1c1c1c",
  shimmerHighlight = "rgba(255,255,255,0.07)",
  ...props
}: ShimmerImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [w, setW] = useState(0);
  const shimX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loaded || w === 0) return;
    shimX.setValue(-w);
    loopRef.current = Animated.loop(
      Animated.timing(shimX, {
        toValue: w * 2,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, [w, loaded]);

  const handleLoad: ImageProps["onLoad"] = (e) => {
    loopRef.current?.stop();
    Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true })
      .start(() => setLoaded(true));
    onLoad?.(e);
  };

  return (
    <View
      style={[style, styles.container]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Image {...props} style={styles.fill} onLoad={handleLoad} />
      {!loaded && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: fade, backgroundColor: shimmerBase }]}
          pointerEvents="none"
        >
          {w > 0 && (
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: shimX }] }]}
            >
              <LinearGradient
                colors={["transparent", shimmerHighlight, "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ width: w, height: "100%" }}
              />
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
});
