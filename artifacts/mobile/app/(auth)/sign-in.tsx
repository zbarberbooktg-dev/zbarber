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
import { consumeAuthIntent } from "@/lib/authIntent";
import { PasswordInput } from "@/components/PasswordInput";

export default function SignInScreen() {
  const c = useColors();
  const { t } = useApp();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [intent] = useState(() => consumeAuthIntent());

  if (intent === "signup") {
    return <Redirect href="/(auth)/sign-up" />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  const busy = fetchStatus === "fetching";

  const handleSubmit = async () => {
    setSubmitError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setSubmitError("Veuillez saisir votre email et votre mot de passe");
      return;
    }
    try {
      const { error } = await signIn.password({ identifier: trimmed, password });
      if (error) {
        setSubmitError(error.message ?? "Identifiants invalides");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: () => router.replace("/"),
        });
        return;
      }
      const fieldErr =
        (errors as any)?.fields?.identifier?.message ||
        (errors as any)?.fields?.password?.message ||
        (errors as any)?.global?.[0]?.message;
      setSubmitError(
        fieldErr ??
          `Connexion impossible (statut: ${signIn.status ?? "inconnu"}). Vérifiez vos identifiants.`,
      );
    } catch (err: any) {
      console.warn("[sign-in] error", err);
      setSubmitError(err?.message ?? err?.errors?.[0]?.message ?? "Erreur de connexion");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
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
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={c.mutedForeground}
        />

        {(() => {
          const signalErr =
            (errors as any)?.fields?.identifier?.message ||
            (errors as any)?.fields?.password?.message ||
            (errors as any)?.global?.[0]?.message;
          const msg = submitError || signalErr;
          return msg ? (
            <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
              {msg}
            </Text>
          ) : null;
        })()}

        <Pressable
          onPress={handleSubmit}
          disabled={busy}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            padding: 16,
            borderRadius: c.radius,
            alignItems: "center",
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
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
