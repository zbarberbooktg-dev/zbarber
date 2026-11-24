import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useSegments } from "expo-router";
import { useAuth } from "@clerk/expo";
import { reloadAppAsync } from "expo";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { consumeAuthIntent } from "@/lib/authIntent";
import { ActiveSessionGate, SessionTransition, SessionTransitionBoundary } from "@/components/ActiveSessionGate";

export default function BarberTabs() {
  const c = useColors();
  const { role, ready, syncAuth, user, barberProfile, t, lang, signingOut, signOutDestination, suspendedNotice } = useApp();
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const isWeb = Platform.OS === "web";
  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);
  const waitingForAuth = !isLoaded || !ready || !!(isSignedIn && !user);

  useEffect(() => {
    if (!waitingForAuth) {
      setAuthWaitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setAuthWaitTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [waitingForAuth]);

  const retryAuth = () => {
    setAuthWaitTimedOut(false);
    if (!isLoaded) {
      void reloadAppAsync();
      return;
    }
    void syncAuth().catch(() => {});
  };

  if (signingOut && !user) return <SessionTransition signingOut />;
  if (suspendedNotice && isSignedIn) return <ActiveSessionGate />;
  if (waitingForAuth) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: 28 }}>
        {!authWaitTimedOut ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            <Feather name="wifi-off" size={30} color={c.primary} />
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center", marginTop: 16 }}>
              {lang === "fr" ? "Vérification de la session impossible" : "Unable to check your session"}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", marginTop: 8 }}>
              {lang === "fr" ? "Vérifiez votre connexion réseau, puis réessayez." : "Check your network connection, then try again."}
            </Text>
            <Pressable
              onPress={retryAuth}
              accessibilityRole="button"
              style={{ marginTop: 20, backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                {lang === "fr" ? "Réessayer" : "Retry"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }
  if (!isSignedIn) {
    const intent = consumeAuthIntent();
    if (intent === "signup") return <Redirect href="/(auth)/sign-up" />;
    if (intent !== "signin" && signOutDestination) return <Redirect href={signOutDestination} />;
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (role === "client") return <Redirect href="/(client)" />;
  if (role !== "barber" && role !== "admin") return <Redirect href="/(auth)/sign-in" />;
  // Gate only on human salon approval, never on document presence or review.
  // Legacy awaiting_document salons still need admin approval (not a document).
  const blocked =
    role === "barber" && !!barberProfile && barberProfile.status !== "approved";
  // `pending` lives inside THIS layout, so redirecting to it unconditionally
  // re-fires the redirect on every render → "Maximum update depth exceeded".
  // Only redirect when we're not already on the pending screen; once there, fall
  // through and render the Tabs navigator so the pending screen can display.
  const onPending = segments[segments.length - 1] === "pending";
  if (blocked && !onPending) {
    return <Redirect href="/(barber)/pending" />;
  }
  // Pending surfaces also offer the optional document upload.
  const featureTabHref = blocked ? null : undefined;
  const profileTabHref = blocked ? null : undefined;

  return (
    <SessionTransitionBoundary busy={signingOut}>
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
          href: profileTabHref,
          title: t.tabProfile,
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="hours" options={{ href: null }} />
      <Tabs.Screen name="home-service" options={{ href: null }} />
      <Tabs.Screen name="slots" options={{ href: null }} />
      <Tabs.Screen name="financing" options={{ href: null }} />
      <Tabs.Screen name="gallery" options={{ href: null }} />
      <Tabs.Screen name="realisations" options={{ href: null }} />
      <Tabs.Screen name="panoramas" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="queue" options={{ href: null }} />
    </Tabs>
    </SessionTransitionBoundary>
  );
}
