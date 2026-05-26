import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar, Button, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ClientProfile() {
  const c = useColors();
  const router = useRouter();
  const { themePref, setThemePref, signOut } = useApp();

  const themeOptions: Array<{ key: ThemePref; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { key: "system", label: "Auto", icon: "smartphone" },
    { key: "light", label: "Clair", icon: "sun" },
    { key: "dark", label: "Sombre", icon: "moon" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name="Mon Compte" size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              Mon compte
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              Compte client
            </Text>
          </View>
        </View>
      </Card>

      <View>
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
          Apparence
        </Text>
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
          Compte
        </Text>
        <View style={{ gap: 10 }}>
          <Button
            label="Passer en mode Barbier"
            variant="secondary"
            icon="refresh-cw"
            onPress={async () => {
              await signOut();
              router.replace("/role-select");
            }}
          />
          <Button
            label="Se déconnecter"
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
