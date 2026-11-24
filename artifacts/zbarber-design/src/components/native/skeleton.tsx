import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View, type ViewProps } from "react-native";
import { useColors } from "../../hooks/use-colors";

export function Skeleton({ style, ...props }: ViewProps) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.65)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { opacity.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.65, duration: 900, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View accessible={false} importantForAccessibility="no-hide-descendants"
    {...props} style={[{ height: 16, backgroundColor: c.secondary, borderRadius: 8, opacity }, style]} />;
}
