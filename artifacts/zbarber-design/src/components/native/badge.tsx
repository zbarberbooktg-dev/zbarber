import React from "react";
import { View, type ViewProps } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { Typography } from "./typography";

export function Badge({ children, variant = "default", style, ...props }: ViewProps & {
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  const c = useColors();
  return <View {...props} style={[{ alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: variant === "outline" ? "transparent" : variant === "default" ? c.primary : variant === "destructive" ? c.destructive : c.secondary,
    borderWidth: variant === "outline" ? 1 : 0, borderColor: c.border }, style]}>
    <Typography variant="caption" color={variant === "default" ? c.primaryForeground : variant === "destructive" ? c.destructiveForeground : c.foreground}>{children}</Typography>
  </View>;
}
