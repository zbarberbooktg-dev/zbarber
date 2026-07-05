import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type Props = {
  onFinish: () => void;
  holdMs?: number;
};

/**
 * Custom animated splash overlay shown right after the native splash
 * screen hides. Fades/scales the logo in, holds it with a subtle pulse,
 * then fades the whole overlay out before revealing the app. Total time
 * on screen (native splash + this overlay) is ~4s.
 */
export function AnimatedSplash({ onFinish, holdMs = 4000 }: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const introAnim = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.07,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    introAnim.start(() => pulse.start());

    const exitTimer = setTimeout(() => {
      pulse.stop();
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }, holdMs);

    return () => {
      clearTimeout(exitTimer);
      introAnim.stop();
      pulse.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.Image
        source={require("@/assets/images/splash-icon.png")}
        resizeMode="contain"
        style={{
          width: 180,
          height: 180,
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#0C1118",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 999,
  },
});
