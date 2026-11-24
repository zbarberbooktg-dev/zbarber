import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "@/hooks/home/useReducedMotion";

/** Mounts children only when ready (deferring their queries) and fades them in unless motion is reduced. */
export function LazyMount({ ready, placeholder, children, style }: {
  ready: boolean; placeholder: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    if (reduce) { opacity.setValue(1); return; }
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [ready, reduce, opacity]);
  if (!ready) return <>{placeholder}</>;
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}
