import { Feather } from "@expo/vector-icons";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";

export const HOME_NAV_HEIGHT = 58;

/** Same five destinations as the client tab bar; Home is the current screen. */
export function HomeBottomNav() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, role } = useApp();
  const fr = lang === "fr";
  const staff = role === "barber" || role === "admin";
  const items: { key: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string; go?: () => void }[] = [
    { key: "home", icon: "home", label: fr ? "Accueil" : "Home" },
    { key: "explore", icon: "compass", label: fr ? "Explorer" : "Explore", go: () => router.push("/salons") },
    { key: "bookings", icon: "calendar", label: fr ? "Réservations" : "Bookings", go: () => router.push("/(client)/bookings") },
    { key: "favorites", icon: "heart", label: fr ? "Favoris" : "Favorites", go: () => router.push("/(client)/favorites") },
    { key: "profile", icon: "user", label: fr ? "Profil" : "Profile", go: () => router.push(staff ? "/(barber)/profile" : "/(client)/profile") },
  ];
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border,
      paddingBottom: Platform.OS === "web" ? 34 : Math.max(insets.bottom, 6) }]}>
      {items.map((it) => {
        const active = !it.go;
        return (
          <Pressable key={it.key} testID={`home-nav-${it.key}`} accessibilityRole="tab" accessibilityState={{ selected: active }}
            accessibilityLabel={it.label} onPress={it.go} style={styles.item}>
            <Feather name={it.icon} size={20} color={active ? c.primary : c.mutedForeground} />
            <Typography variant="caption" color={active ? c.primary : c.mutedForeground} numberOfLines={1} style={styles.label}>{it.label}</Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 6 },
  item: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 10, lineHeight: 13 },
});
