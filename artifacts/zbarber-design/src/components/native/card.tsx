import React from "react";
import { View, type ViewProps } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { Typography } from "./typography";

export function Card({ style, ...props }: ViewProps) {
  const c = useColors();
  return <View {...props} style={[{ backgroundColor: c.card, borderRadius: c.radius, padding: 16 }, style]} />;
}
export function CardHeader({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ gap: 5, marginBottom: 12 }, style]} />;
}
export function CardContent({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ gap: 12 }, style]} />;
}
export function CardFooter({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ flexDirection: "row", gap: 8, marginTop: 12 }, style]} />;
}
export function CardTitle(props: React.ComponentProps<typeof Typography>) {
  return <Typography variant="subtitle" {...props} />;
}
export function CardDescription(props: React.ComponentProps<typeof Typography>) {
  const c = useColors();
  return <Typography variant="caption" color={c.mutedForeground} {...props} />;
}
