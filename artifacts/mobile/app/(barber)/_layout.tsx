import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@clerk/expo";
import React from "react";
import { Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { consumeAuthIntent } from "@/lib/authIntent";

export default function BarberTabs() {
  const c = useColors();
  const { role, ready, syncing, user, barberProfile, t } = useApp();
  const { isSignedIn } = useAuth();
  const isWeb = Platform.OS === "web";

  if (!ready || (isSignedIn && syncing && !user)) return null;
  if (!isSignedIn) {
    const intent = consumeAuthIntent();
    if (intent === "signup") return <Redirect href="/(auth)/sign-up" />;
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (role === "client") return <Redirect href="/(client)" />;
  if (role !== "barber" && role !== "admin") return <Redirect href="/(auth)/sign-in" />;
  // Stage gating (use barber profile status, not user account status):
  // - awaiting_document barbers keep access to the Profile tab (where they
  //   upload/track their authorization document) but all other barber feature
  //   tabs are hidden until final approval.
  // - any other non-approved status (pending/rejected/suspended) is sent to the
  //   pending screen.
  const awaitingDocument = role === "barber" && barberProfile?.status === "awaiting_document";
  if (role === "barber" && barberProfile && barberProfile.status !== "approved" && !awaitingDocument) {
    return <Redirect href="/(barber)/pending" />;
  }
  const featureTabHref = awaitingDocument ? null : undefined;

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
          href: featureTabHref,
          title: t.tabSalon,
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          href: featureTabHref,
          title: t.tabSchedule,
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          href: featureTabHref,
          title: "Services",
          tabBarIcon: ({ color, size }) => <Feather name="scissors" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          href: featureTabHref,
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
      <Tabs.Screen name="slots" options={{ href: null }} />
      <Tabs.Screen name="financing" options={{ href: null }} />
      <Tabs.Screen name="gallery" options={{ href: null }} />
      <Tabs.Screen name="realisations" options={{ href: null }} />
      <Tabs.Screen name="panoramas" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="queue" options={{ href: null }} />
    </Tabs>
  );
}
