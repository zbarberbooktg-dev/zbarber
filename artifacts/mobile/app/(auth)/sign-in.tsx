import { useSignIn, useAuth } from "@clerk/expo";
import { Link, Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const c = useColors();
  const { t } = useApp();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  const busy = fetchStatus === "fetching";

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const { error } = await signIn.password({ identifier: email.trim(), password });
      if (error) {
        setSubmitError(error.message ?? "Erreur de connexion");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: () => router.replace("/"),
        });
      }
    } catch (err: any) {
      setSubmitError(err?.message ?? "Erreur de connexion");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: c.foreground, marginBottom: 8 }}>
            Bon retour
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            Connectez-vous à votre compte Global Barber
          </Text>
        </View>

        <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="vous@exemple.com"
          placeholderTextColor={c.mutedForeground}
          style={{
            backgroundColor: c.card,
            color: c.foreground,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: c.radius,
            padding: 14,
            marginBottom: 16,
            fontFamily: "Inter_400Regular",
          }}
        />

        <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Mot de passe</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={c.mutedForeground}
          style={{
            backgroundColor: c.card,
            color: c.foreground,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: c.radius,
            padding: 14,
            marginBottom: 16,
            fontFamily: "Inter_400Regular",
          }}
        />

        {(submitError || (errors as any)?.raw?.[0]?.message) && (
          <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
            {submitError || (errors as any)?.raw?.[0]?.message}
          </Text>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={busy || !email || !password}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            padding: 16,
            borderRadius: c.radius,
            alignItems: "center",
            opacity: busy || !email || !password ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
              Se connecter
            </Text>
          )}
        </Pressable>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Pas de compte ? </Text>
          <Link href="/(auth)/sign-up" replace>
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>S'inscrire</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
