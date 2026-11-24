import React, { forwardRef } from "react";
import { Platform, StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useColors } from "../../hooks/use-colors";

export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  const c = useColors();
  return <TextInput ref={ref} placeholderTextColor={c.mutedForeground} selectionColor={c.primary}
    {...props} style={StyleSheet.flatten([{ minHeight: 48, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
      borderRadius: 12, backgroundColor: c.card, color: c.foreground,
      borderWidth: 1, borderColor: c.border, fontFamily: Platform.OS === "web" ? "Inter,Inter_400Regular" : "Inter_400Regular", fontSize: 14 }, style])} />;
});
