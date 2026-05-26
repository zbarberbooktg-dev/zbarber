import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ClientTabs() {
  const c = useColors();
  const { role, ready } = useApp();
  const isWeb = Platform.OS === "web";

  if (!ready) return null;
  if (role !== "client") return <Redirect href={role === "barber" ? "/(barber)" : "/role-select"} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
        headerStyle: { backgroundColor: c.background },
        headerTitleStyle: { fontFamily: "Inter_700Bold", color: c.foreground },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Découvrir",
          tabBarIcon: ({ color, size }) => <Feather name="search" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Réservations",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen name="barber/[id]" options={{ href: null, title: "Barbier" }} />
    </Tabs>
  );
}
