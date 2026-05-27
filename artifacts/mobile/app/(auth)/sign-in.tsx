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

type MfaStrategy = "totp" | "phone_code" | "email_code" | "backup_code";

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

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [availableStrategies, setAvailableStrategies] = useState<MfaStrategy[]>([]);
  const [info, setInfo] = useState<string | null>(null);

  if (intent === "signup") {
    return <Redirect href="/(auth)/sign-up" />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  const busy = fetchStatus === "fetching";

  const enterMfa = async () => {
    const factors = (signIn.supportedSecondFactors ?? []) as Array<{ strategy: string }>;
    const strategies = factors
      .map((f) => f.strategy)
      .filter((s): s is MfaStrategy =>
        s === "totp" || s === "phone_code" || s === "email_code" || s === "backup_code",
      );
    setAvailableStrategies(strategies);
    if (strategies.length === 0) {
      setSubmitError(
        "Aucune méthode de vérification en deux étapes prise en charge sur cet appareil. Connectez-vous depuis le site web pour gérer vos paramètres de sécurité.",
      );
      return;
    }
    const preferred: MfaStrategy =
      strategies.find((s) => s === "totp") ??
      strategies.find((s) => s === "phone_code") ??
      strategies.find((s) => s === "email_code") ??
      strategies[0]!;
    setMfaStrategy(preferred);
    setStep("mfa");
    setMfaCode("");
    setInfo(null);
    if (preferred === "phone_code") {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) setSubmitError(error.message ?? "Impossible d'envoyer le code SMS");
      else setInfo("Code envoyé par SMS");
    } else if (preferred === "email_code") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) setSubmitError(error.message ?? "Impossible d'envoyer le code par email");
      else setInfo("Code envoyé par email");
    }
  };

  const switchStrategy = async (next: MfaStrategy) => {
    setSubmitError(null);
    setInfo(null);
    setMfaCode("");
    setMfaStrategy(next);
    if (next === "phone_code") {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) setSubmitError(error.message ?? "Impossible d'envoyer le code SMS");
      else setInfo("Code envoyé par SMS");
    } else if (next === "email_code") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) setSubmitError(error.message ?? "Impossible d'envoyer le code par email");
      else setInfo("Code envoyé par email");
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setInfo(null);
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
        await signIn.finalize({ navigate: () => router.replace("/") });
        return;
      }
      if (signIn.status === "needs_second_factor") {
        await enterMfa();
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

  const handleMfaSubmit = async () => {
    setSubmitError(null);
    setInfo(null);
    const code = mfaCode.trim();
    if (!code) {
      setSubmitError("Veuillez saisir le code de vérification");
      return;
    }
    try {
      let res: { error: any } = { error: null };
      if (mfaStrategy === "totp") {
        res = await signIn.mfa.verifyTOTP({ code });
      } else if (mfaStrategy === "phone_code") {
        res = await signIn.mfa.verifyPhoneCode({ code });
      } else if (mfaStrategy === "email_code") {
        res = await signIn.mfa.verifyEmailCode({ code });
      } else if (mfaStrategy === "backup_code") {
        res = await signIn.mfa.verifyBackupCode({ code });
      }
      if (res.error) {
        setSubmitError(res.error.message ?? "Code invalide");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({ navigate: () => router.replace("/") });
        return;
      }
      setSubmitError(`Vérification incomplète (statut: ${signIn.status ?? "inconnu"})`);
    } catch (err: any) {
      console.warn("[sign-in mfa] error", err);
      setSubmitError(err?.message ?? err?.errors?.[0]?.message ?? "Erreur de vérification");
    }
  };

  const mfaLabel = (s: MfaStrategy) =>
    s === "totp"
      ? "App d'authentification"
      : s === "phone_code"
        ? "Code SMS"
        : s === "email_code"
          ? "Code par email"
          : "Code de secours";

  const mfaPlaceholder =
    mfaStrategy === "backup_code" ? "Code de secours" : "Code à 6 chiffres";

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
        {step === "credentials" ? (
          <>
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
          </>
        ) : (
          <>
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, marginBottom: 8 }}>
                Vérification en deux étapes
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                {mfaStrategy === "totp"
                  ? "Saisissez le code généré par votre application d'authentification."
                  : mfaStrategy === "phone_code"
                    ? "Saisissez le code reçu par SMS."
                    : mfaStrategy === "email_code"
                      ? "Saisissez le code reçu par email."
                      : "Saisissez l'un de vos codes de secours."}
              </Text>
            </View>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>
              {mfaPlaceholder}
            </Text>
            <TextInput
              value={mfaCode}
              onChangeText={setMfaCode}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={mfaStrategy === "backup_code" ? "default" : "number-pad"}
              placeholder={mfaPlaceholder}
              placeholderTextColor={c.mutedForeground}
              style={{
                backgroundColor: c.card,
                color: c.foreground,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: c.radius,
                padding: 14,
                marginBottom: 12,
                fontFamily: "Inter_400Regular",
                letterSpacing: 2,
              }}
            />

            {info && (
              <Text style={{ color: c.mutedForeground, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
                {info}
              </Text>
            )}
          </>
        )}

        {(() => {
          const signalErr =
            (errors as any)?.fields?.identifier?.message ||
            (errors as any)?.fields?.password?.message ||
            (errors as any)?.fields?.code?.message ||
            (errors as any)?.global?.[0]?.message;
          const msg = submitError || signalErr;
          return msg ? (
            <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
              {msg}
            </Text>
          ) : null;
        })()}

        <Pressable
          onPress={step === "credentials" ? handleSubmit : handleMfaSubmit}
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
              {step === "credentials" ? "Se connecter" : "Vérifier"}
            </Text>
          )}
        </Pressable>

        {step === "mfa" && availableStrategies.length > 1 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 8 }}>
              Utiliser une autre méthode :
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {availableStrategies
                .filter((s) => s !== mfaStrategy)
                .map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => switchStrategy(s)}
                    disabled={busy}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                      {mfaLabel(s)}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </View>
        )}

        {step === "mfa" && (
          <Pressable
            onPress={() => {
              setStep("credentials");
              setSubmitError(null);
              setInfo(null);
              setMfaCode("");
            }}
            style={{ marginTop: 16, alignItems: "center" }}
          >
            <Text style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>Retour</Text>
          </Pressable>
        )}

        {step === "credentials" && (
          <>
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Link href="/(auth)/forgot-password">
                <Text style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>
                  Mot de passe oublié ?
                </Text>
              </Link>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Pas de compte ? </Text>
              <Link href="/(auth)/sign-up" replace>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>S'inscrire</Text>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
