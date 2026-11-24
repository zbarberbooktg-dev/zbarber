import React from "react";
import { Platform, Text, type TextProps } from "react-native";
import { nativeFonts } from "../../lib/native-theme";
import { useColors } from "../../hooks/use-colors";

const sizes = { display: 30, title: 23, subtitle: 17, body: 14, label: 13, caption: 11 };
export function Typography({ variant = "body", color, style, ...props }: TextProps & {
  variant?: keyof typeof nativeFonts; color?: string;
}) {
  const c = useColors();
  const serif = variant === "display" || variant === "title";
  const family = Platform.OS === "web" ? `${serif ? '"Playfair Display"' : "Inter"},${nativeFonts[variant]}` : nativeFonts[variant];
  return <Text {...props} style={[{ color: color ?? c.foreground, fontFamily: family,
    ...(Platform.OS === "web" ? { fontWeight: serif ? "500" as const : variant === "label" || variant === "subtitle" ? "600" as const : "400" as const } : {}),
    fontSize: sizes[variant], lineHeight: Math.round(sizes[variant] * 1.4) }, style]} />;
}
