import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@clerk/expo";
import React from "react";
import { Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ClientTabs() {
  const c = useColors();
  const { role, ready, syncing, user, t } = useApp();
  const { isSignedIn } = useAuth();
  const isWeb = Platform.OS === "web";

  if (!ready || (isSignedIn && syncing && !user)) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (role === "barber" || role === "admin") return <Redirect href="/(barber)" />;
  if (role !== "client") return <Redirect href="/(auth)/sign-in" />;

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
        name="bookings"
        options={{
          title: t.tabBookings,
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabProfile,
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
