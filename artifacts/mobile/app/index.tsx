import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const c = useColors();
  const { isSignedIn } = useAuth();
  const { ready, syncing, user, signOut } = useApp();

  if (!ready || (isSignedIn && syncing && !user)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  // Signed in on Clerk but the server refused to sync the local profile
  // (e.g. account suspended). Don't bounce back to sign-in — that creates an
  // infinite loop because sign-in sees isSignedIn=true and redirects here.
  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24, gap: 16 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 18, textAlign: "center" }}>
          Compte indisponible
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
          Impossible de charger votre profil. Votre compte est peut-être suspendu ou en attente. Contactez le support.
        </Text>
        <Pressable
          onPress={() => signOut()}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: c.radius,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Se déconnecter</Text>
        </Pressable>
      </View>
    );
  }

  if (user.role === "admin" || user.role === "barber") {
    if (user.role === "barber" && user.status !== "active") {
      return <Redirect href="/(barber)/pending" />;
    }
    return <Redirect href="/(barber)" />;
  }
  return <Redirect href="/(client)" />;
}
