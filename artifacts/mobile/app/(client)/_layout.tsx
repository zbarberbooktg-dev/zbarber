import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { reloadAppAsync } from "expo";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { consumeAuthIntent } from "@/lib/authIntent";
import { setBrowsing } from "@/lib/browseIntent";

export default function ClientTabs() {
  const c = useColors();
  const router = useRouter();
  const { role, ready, syncing, authSyncError, syncAuth, user, t, lang } = useApp();
  const { isSignedIn, isLoaded } = useAuth();
  const isWeb = Platform.OS === "web";
  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);
  const waitingForAuth = !isLoaded || !ready || !!(isSignedIn && !user && (syncing || authSyncError));

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

  const HomeHeaderButton = () => (
    <Pressable
      onPress={() => {
        setBrowsing(true);
        router.push("/browse");
      }}
      hitSlop={8}
      accessibilityLabel={(t as any).home ?? "Accueil"}
      style={{
        marginRight: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.muted,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="home" size={17} color={c.primary} />
    </Pressable>
  );

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
    return <Redirect href="/(auth)/sign-in" />;
  }
  // A barber account can browse and book exactly like a client, so it is
  // allowed into the client tab group. Admins are redirected to their console.
  if (role === "admin") return <Redirect href="/(barber)" />;
  if (role !== "client" && role !== "barber") return <Redirect href="/(auth)/sign-in" />;

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
          headerRight: () => <HomeHeaderButton />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t.tabFavorites,
          tabBarIcon: ({ color, size }) => <Feather name="heart" size={size - 2} color={color} />,
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
