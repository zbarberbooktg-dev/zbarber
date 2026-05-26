import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function BarberTabs() {
  const c = useColors();
  const { role, ready } = useApp();
  const isWeb = Platform.OS === "web";

  if (!ready) return null;
  if (role !== "barber") return <Redirect href={role === "client" ? "/(client)" : "/role-select"} />;
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
          title: "Salon",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Avis",
          tabBarIcon: ({ color, size }) => <Feather name="star" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
