import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { role, ready } = useApp();
  const c = useColors();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.background,
        }}
      >
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!role) return <Redirect href="/role-select" />;
  if (role === "client") return <Redirect href="/(client)" />;
  return <Redirect href="/(barber)" />;
}
