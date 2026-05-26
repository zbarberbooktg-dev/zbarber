import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EditProfileModal } from "@/components/EditProfileModal";
import { Avatar, Button, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";
import { useColors } from "@/hooks/useColors";

export default function ClientProfile() {
  const c = useColors();
  const router = useRouter();
  const { themePref, setThemePref, lang, setLang, signOut, t, user } = useApp();
  const [editOpen, setEditOpen] = useState(false);

  const themeOptions: Array<{ key: ThemePref; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { key: "system", label: t.themeAuto, icon: "smartphone" },
    { key: "light", label: t.themeLight, icon: "sun" },
    { key: "dark", label: t.themeDark, icon: "moon" },
  ];

  const langOptions: Array<{ key: Lang; label: string }> = [
    { key: "fr", label: "Français" },
    { key: "en", label: "English" },
  ];

  const SectionLabel = ({ label }: { label: string }) => (
    <Text
      style={{
        color: c.mutedForeground,
        fontFamily: "Inter_600SemiBold",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {label}
    </Text>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={user?.name ?? t.myAccount} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {user?.name ?? t.myAccount}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {user?.email ?? t.clientAccount}
            </Text>
          </View>
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={10}
            style={({ pressed }) => ({
              padding: 8,
              borderRadius: c.radius - 4,
              backgroundColor: pressed ? c.accent : "transparent",
            })}
          >
            <Feather name="edit-2" size={18} color={c.primary} />
          </Pressable>
        </View>
      </Card>

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={user?.name ?? ""}
        initialPhone={user?.phone ?? ""}
      />

      <View>
        <SectionLabel label={t.appearance} />
        <Card style={{ flexDirection: "row", gap: 8, padding: 8 }}>
          {themeOptions.map((opt) => {
            const active = themePref === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setThemePref(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: c.radius - 4,
                  backgroundColor: active ? c.accent : "transparent",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Feather name={opt.icon} size={18} color={active ? c.primary : c.mutedForeground} />
                <Text
                  style={{
                    color: active ? c.primary : c.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionLabel label={t.language} />
        <Card style={{ flexDirection: "row", gap: 8, padding: 8 }}>
          {langOptions.map((opt) => {
            const active = lang === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: c.radius - 4,
                  backgroundColor: active ? c.accent : "transparent",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? c.primary : c.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionLabel label={t.account} />
        <View style={{ gap: 10 }}>
          <Button
            label={t.switchToBarber}
            variant="secondary"
            icon="refresh-cw"
            onPress={async () => {
              await signOut();
              router.replace("/role-select");
            }}
          />
          <Button
            label={t.signOut}
            variant="ghost"
            icon="log-out"
            onPress={async () => {
              await signOut();
              router.replace("/role-select");
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
