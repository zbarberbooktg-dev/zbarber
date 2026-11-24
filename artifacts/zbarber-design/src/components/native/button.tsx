import React from "react";
import { Platform, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useColors } from "../../hooks/use-colors";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/** Native button follows web variants; icon targets remain at least 44 points. */
export function Button({ children, variant = "default", size = "default", style, textStyle, disabled, ...props }: ButtonProps) {
  const c = useColors();
  const color = variant === "default" ? c.primaryForeground : variant === "destructive"
    ? c.destructiveForeground : variant === "link" ? (c.isDark ? c.primary : c.ring) : c.foreground;
  const backgroundColor = variant === "default" ? c.primary : variant === "secondary" ? c.secondary
    : variant === "destructive" ? c.destructive : "transparent";
  return (
    <Pressable {...props} disabled={disabled} accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      style={({ pressed }) => [{
        minHeight: 44, minWidth: 44, borderRadius: 12, backgroundColor,
        flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
        paddingHorizontal: size === "icon" ? 0 : size === "lg" ? 22 : 14,
        ...(size === "icon" ? { width: 44, height: 44 } : {}),
        borderWidth: variant === "outline" ? 1 : 0, borderColor: c.border,
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
      }, style]}>
      {React.Children.map(children, (child) => typeof child === "string" || typeof child === "number"
        ? <Text style={[{ color, fontFamily: Platform.OS === "web" ? "Inter,Inter_600SemiBold" : "Inter_600SemiBold",
          ...(Platform.OS === "web" ? { fontWeight: "600" as const } : {}), fontSize: size === "sm" ? 12 : 14 }, textStyle]}>{child}</Text>
        : child)}
    </Pressable>
  );
}
