import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";
import { useColors } from "@/hooks/useColors";

type Icon = keyof typeof Feather.glyphMap;

export function ProfileSectionTitle({ label, icon }: { label: string; icon: Icon }) {
  const c = useColors();
  return (
    <View style={styles.heading}>
      <Feather name={icon} size={16} color={c.primary} />
      <Text accessibilityRole="header" style={[styles.headingText, { color: c.foreground }]}>{label}</Text>
    </View>
  );
}

export function ProfileIdentity({ name, email, role, onEdit }: {
  name: string; email?: string | null; role: string; onEdit: () => void;
}) {
  const c = useColors();
  const { lang } = useApp();
  return (
    <Card style={[styles.identity, { borderRadius: c.radius + 8 }]}>
      <View style={[styles.identityBand, { backgroundColor: c.accent }]}>
        <Feather name="user" size={12} color={c.primary} />
        <Text style={[styles.role, { color: c.accentForeground }]}>{role}</Text>
      </View>
      <View style={styles.identityRow}>
        <Avatar name={name} size={56} />
        <View style={styles.identityText}>
          <Text numberOfLines={2} style={[styles.name, { color: c.foreground }]}>{name}</Text>
          {!!email && <Text numberOfLines={1} style={[styles.email, { color: c.mutedForeground }]}>{email}</Text>}
        </View>
        <Pressable testID="profile-edit" accessibilityRole="button" accessibilityLabel={lang === "fr" ? "Modifier le profil" : "Edit profile"}
          onPress={onEdit} style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.65 : 1 }]}>
          <Feather name="edit-2" size={19} color={c.primary} />
        </Pressable>
      </View>
    </Card>
  );
}

export function ProfilePreferences() {
  const c = useColors();
  const { themePref, setThemePref, lang, setLang, t } = useApp();
  const appearance: { key: ThemePref; label: string; icon: Icon }[] = [
    { key: "system", label: t.themeAuto, icon: "smartphone" },
    { key: "light", label: t.themeLight, icon: "sun" },
    { key: "dark", label: t.themeDark, icon: "moon" },
  ];
  const languages: { key: Lang; label: string }[] = [
    { key: "fr", label: "Français" },
    { key: "en", label: "English" },
  ];
  return (
    <View>
      <ProfileSectionTitle label={lang === "fr" ? "Préférences" : "Preferences"} icon="sliders" />
      <Card style={[styles.preferences, { borderRadius: c.radius + 6 }]}>
        <Text style={[styles.preferenceLabel, { color: c.foreground }]}>{t.appearance}</Text>
        <View style={[styles.options, { backgroundColor: c.muted }]} accessibilityRole="radiogroup">
          {appearance.map(({ key, label, icon }) => (
            <Pressable key={key} testID={`profile-theme-${key}`} accessibilityRole="radio"
              accessibilityState={{ checked: themePref === key }} onPress={() => setThemePref(key)}
              style={[styles.option, themePref === key && { backgroundColor: c.accent }]}>
              <Feather name={icon} size={17} color={themePref === key ? c.primary : c.mutedForeground} />
              <Text style={[styles.optionText, { color: themePref === key ? c.accentForeground : c.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.preferenceLabel, { color: c.foreground }]}>{t.language}</Text>
        <View style={[styles.options, { backgroundColor: c.muted }]} accessibilityRole="radiogroup">
          {languages.map(({ key, label }) => (
            <Pressable key={key} testID={`profile-language-${key}`} accessibilityRole="radio"
              accessibilityState={{ checked: lang === key }} onPress={() => setLang(key)}
              style={[styles.option, lang === key && { backgroundColor: c.accent }]}>
              <Text style={[styles.optionText, { color: lang === key ? c.accentForeground : c.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 3 },
  headingText: { fontFamily: "Inter_700Bold", fontSize: 18, flexShrink: 1 },
  identity: { padding: 0, overflow: "hidden" },
  identityBand: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  role: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", flexShrink: 1 },
  identityRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  identityText: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: "Inter_700Bold", fontSize: 20, lineHeight: 25 },
  email: { fontFamily: "Inter_400Regular", fontSize: 13 },
  edit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  preferences: { gap: 10 },
  preferenceLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  options: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 12 },
  option: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, minHeight: 44, borderRadius: 9 },
  optionText: { fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "center" },
});
