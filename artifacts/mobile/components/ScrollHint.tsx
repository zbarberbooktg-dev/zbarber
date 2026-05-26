import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, Text } from "react-native";

type Props = {
  label: string;
  visible: boolean;
};

export function ScrollHint({ label, visible }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 8,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 28,
        left: 0,
        right: 0,
        alignItems: "center",
        opacity,
        transform: [{ translateY: bounce }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: "rgba(212, 175, 55, 0.95)",
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Text style={{ color: "#0A0A0A", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
          {label}
        </Text>
        <Feather name="chevron-down" size={16} color="#0A0A0A" />
      </View>
    </Animated.View>
  );
}
