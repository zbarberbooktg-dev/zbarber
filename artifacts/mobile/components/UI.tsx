import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  fullWidth,
}: ButtonProps) {
  const c = useColors();
  const bg =
    variant === "primary"
      ? c.primary
      : variant === "destructive"
        ? c.destructive
        : variant === "secondary"
          ? c.secondary
          : "transparent";
  const fg =
    variant === "primary"
      ? c.primaryForeground
      : variant === "destructive"
        ? c.destructiveForeground
        : variant === "secondary"
          ? c.secondaryForeground
          : c.foreground;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: c.radius,
          paddingVertical: 14,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: c.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={{ color: fg, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}) {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: c.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style as ViewStyle]}>{children}</View>;
}

export function Pill({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
  icon?: keyof typeof Feather.glyphMap;
}) {
  const c = useColors();
  const map = {
    neutral: { bg: c.muted, fg: c.mutedForeground },
    success: { bg: c.isDark ? "#0F2A1A" : "#DCFCE7", fg: c.success },
    warning: { bg: c.isDark ? "#2A1F0E" : "#FEF3C7", fg: c.warning },
    danger: { bg: c.isDark ? "#2A0F0F" : "#FEE2E2", fg: c.destructive },
    primary: { bg: c.accent, fg: c.primary },
  } as const;
  const t = map[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
      }}
    >
      {icon && <Feather name={icon} size={11} color={t.fg} />}
      <Text style={{ color: t.fg, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = useColors();
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: c.primary,
          fontFamily: "Inter_700Bold",
          fontSize: size * 0.4,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
        {title}
      </Text>
      {action && (
        <Pressable onPress={action.onPress}>
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Feather name={icon} size={24} color={c.mutedForeground} />
      </View>
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 15,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            textAlign: "center",
            maxWidth: 260,
          }}
        >
          {description}
        </Text>
      )}
    </View>
  );
}

export function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const c = useColors();
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon && <Feather name={icon} size={14} color={c.mutedForeground} />}
        <Text
          style={{
            color: c.mutedForeground,
            fontSize: 11,
            fontFamily: "Inter_500Medium",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}
      >
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});
