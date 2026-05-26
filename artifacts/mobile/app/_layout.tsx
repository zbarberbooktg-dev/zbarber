import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import colors from "@/constants/colors";
import { AppProvider, useApp } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ThemedRoot() {
  const { themePref, ready } = useApp();
  const systemScheme = useColorScheme();
  const effective = themePref === "system" ? systemScheme : themePref;
  const palette = effective === "dark" ? colors.dark : colors.light;

  const isWeb = Platform.OS === "web";

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: isWeb ? "#000" : palette.background }}>
        <View
          style={
            isWeb
              ? {
                  flex: 1,
                  width: "100%",
                  maxWidth: 402,
                  alignSelf: "center",
                  backgroundColor: palette.background,
                }
              : { flex: 1, backgroundColor: palette.background }
          }
        />
      </View>
    );
  }

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="role-select" options={{ headerShown: false }} />
      <Stack.Screen name="(client)" options={{ headerShown: false }} />
      <Stack.Screen name="(barber)" options={{ headerShown: false }} />
    </Stack>
  );

  if (isWeb) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
        }}
      >
        <StatusBar style={effective === "dark" ? "light" : "dark"} />
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 402,
            backgroundColor: palette.background,
            overflow: "hidden",
            ...(Platform.OS === "web" ? { boxShadow: "0 0 60px rgba(212, 175, 55, 0.08)" } : {}),
          }}
        >
          {stack}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <StatusBar style={effective === "dark" ? "light" : "dark"} />
      {stack}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <QueryClientProvider client={queryClient}>
                  <AppProvider>
                    <ThemedRoot />
                  </AppProvider>
                </QueryClientProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
