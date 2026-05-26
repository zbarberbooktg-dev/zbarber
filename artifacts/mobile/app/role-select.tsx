import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RoleSelect() {
  const c = useColors();
  const { setRole } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const choose = async (role: "client" | "barber") => {
    await setRole(role);
    router.replace(role === "client" ? "/(client)" : "/(barber)");
  };

  const Option = ({
    role,
    icon,
    title,
    description,
  }: {
    role: "client" | "barber";
    icon: keyof typeof Feather.glyphMap;
    title: string;
    description: string;
  }) => (
    <Pressable
      onPress={() => choose(role)}
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: c.radius,
        padding: 20,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.85 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon} size={26} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 17,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 13,
          }}
        >
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={c.mutedForeground} />
    </Pressable>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        paddingTop: insets.top + 60,
        paddingHorizontal: 24,
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 40 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Feather name="scissors" size={32} color={c.primaryForeground} />
        </View>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 26,
            marginBottom: 6,
          }}
        >
          Global Barber Corp
        </Text>
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            textAlign: "center",
          }}
        >
          La plateforme des barbiers africains
        </Text>
      </View>

      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          marginBottom: 14,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Continuer en tant que
      </Text>

      <View style={{ gap: 12 }}>
        <Option
          role="client"
          icon="user"
          title="Client"
          description="Trouver un barbier, réserver et noter"
        />
        <Option
          role="barber"
          icon="scissors"
          title="Barbier"
          description="Gérer mon salon, agenda et galerie"
        />
      </View>
    </View>
  );
}
