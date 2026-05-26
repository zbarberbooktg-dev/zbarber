import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@clerk/expo";
import React from "react";
import { Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function BarberTabs() {
  const c = useColors();
  const { role, status, ready, syncing, user, t } = useApp();
  const { isSignedIn } = useAuth();
  const isWeb = Platform.OS === "web";

  if (!ready || (isSignedIn && syncing && !user)) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (role === "client") return <Redirect href="/(client)" />;
  if (role !== "barber" && role !== "admin") return <Redirect href="/(auth)/sign-in" />;
  if (role === "barber" && status !== "active") return <Redirect href="/(barber)/pending" />;

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
          title: t.tabSalon,
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t.tabSchedule,
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => <Feather name="scissors" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabProfile,
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="hours" options={{ href: null }} />
    </Tabs>
  );
}
