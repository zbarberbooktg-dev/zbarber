import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function BarberPending() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useApp();

  const isSuspended = user?.status === "suspended";

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: insets.top + 24,
        backgroundColor: c.background,
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: isSuspended ? c.destructive + "20" : c.primary + "20",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Feather
            name={isSuspended ? "alert-circle" : "clock"}
            size={32}
            color={isSuspended ? c.destructive : c.primary}
          />
        </View>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: c.foreground, marginBottom: 8, textAlign: "center" }}>
          {isSuspended ? "Compte suspendu" : "En attente de validation"}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          {isSuspended
            ? "Votre compte barbier a été suspendu. Contactez l'administration pour plus d'informations."
            : "Votre demande d'inscription en tant que barbier est en cours d'examen par l'équipe Zbarber. Vous recevrez une notification dès la validation de votre compte."}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground, marginBottom: 8 }}>
          Votre profil
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, marginBottom: 4 }}>
          {user?.name}
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
          {user?.email}
        </Text>
      </View>

      <Pressable
        onPress={signOut}
        style={({ pressed }) => ({
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
          borderRadius: c.radius,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
