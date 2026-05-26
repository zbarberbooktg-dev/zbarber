import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/expo";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const c = useColors();
  const { isSignedIn } = useAuth();
  const { ready, syncing, user } = useApp();

  if (!ready || (isSignedIn && syncing && !user)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  if (user.role === "admin" || user.role === "barber") {
    if (user.role === "barber" && user.status !== "active") {
      return <Redirect href="/(barber)/pending" />;
    }
    return <Redirect href="/(barber)" />;
  }
  return <Redirect href="/(client)" />;
}
