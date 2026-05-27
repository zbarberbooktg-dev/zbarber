import { useSignIn, useAuth } from "@clerk/expo";
import { Link, Redirect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

import { useColors } from "@/hooks/useColors";
import { PasswordInput } from "@/components/PasswordInput";

type Step = "request" | "reset";

/**
 * Forgot-password flow for mobile clients & barbers (Clerk-backed).
 *
 * Uses Clerk's "future" SignIn API (the only one exposed by @clerk/expo 3.x):
 *   1. signIn.create({ identifier })                     — start an attempt
 *   2. signIn.resetPasswordEmailCode.sendCode()          — email the 6-digit code
 *   3. signIn.resetPasswordEmailCode.verifyCode({code})  — status → needs_new_password
 *   4. signIn.resetPasswordEmailCode.submitPassword({password}) — status → complete
 *   5. signIn.finalize({ navigate })                     — activate session
 *
 * The future API returns `{ error }` instead of throwing, so we surface that
 * directly. If 2FA is enabled, status becomes `needs_second_factor` after
 * submitPassword — we bounce the user back to sign-in to complete MFA.
 */
export default function ForgotPasswordScreen() {
  const c = useColors();
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mfaRedirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (mfaRedirectTimer.current) clearTimeout(mfaRedirectTimer.current);
    };
  }, []);

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  const busy = submitting || fetchStatus === "fetching";

  const friendlyError = (e: unknown): string => {
    const anyE = e as { message?: string; longMessage?: string; errors?: Array<{ message?: string; longMessage?: string }> } | null;
    return (
      anyE?.longMessage ||
      anyE?.message ||
      anyE?.errors?.[0]?.longMessage ||
      anyE?.errors?.[0]?.message ||
      "Une erreur est survenue. Réessayez."
    );
  };

  /**
   * Attempt to start a reset. Errors here would leak whether an account
   * exists (or is eligible), so callers MUST NOT surface them — they may
   * only be logged internally. The UI proceeds to the code-entry step
   * regardless: a real account receives the code, a non-existent one
   * silently fails. The verifyCode step will reject any code in either case.
   */
  const startResetSilently = async (identifier: string): Promise<void> => {
    try {
      const created = await signIn.create({ identifier });
      if (created.error) {
        console.warn("[forgot-password] create failed", created.error);
        return;
      }
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        console.warn("[forgot-password] sendCode failed", sent.error);
      }
    } catch (e) {
      console.warn("[forgot-password] startReset threw", e);
    }
  };

  const handleRequestCode = async () => {
    setErr(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErr("Veuillez saisir votre adresse email");
      return;
    }
    setSubmitting(true);
    try {
      await startResetSilently(trimmed);
      // Enumeration-safe: same outcome whether the account exists or not.
      setStep("reset");
      setInfo(
        `Si un compte est associé à ${trimmed}, un code de réinitialisation vient d'y être envoyé. Vérifiez votre boîte mail.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErr(null);
    setInfo(null);
    setSubmitting(true);
    try {
      // Start a fresh attempt so the code remains valid even if the previous
      // one expired. Errors are intentionally hidden to preserve enumeration safety.
      await startResetSilently(email.trim());
      setInfo("Si un compte existe, un nouveau code a été envoyé.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setErr(null);
    setInfo(null);
    if (!code.trim()) { setErr("Veuillez saisir le code reçu par email"); return; }
    if (password.length < 8) { setErr("Le mot de passe doit faire au moins 8 caractères"); return; }
    if (password !== confirmPassword) { setErr("Les mots de passe ne correspondent pas"); return; }

    setSubmitting(true);
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (verified.error) { setErr(friendlyError(verified.error)); return; }

      const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (submitted.error) { setErr(friendlyError(submitted.error)); return; }

      if (signIn.status === "complete") {
        await signIn.finalize({ navigate: () => router.replace("/") });
        return;
      }

      if (signIn.status === "needs_second_factor") {
        // 2FA-enabled account — bounce to sign-in to complete MFA with the new password.
        setInfo("Mot de passe réinitialisé. Veuillez vous connecter pour finaliser la vérification en deux étapes.");
        mfaRedirectTimer.current = setTimeout(() => router.replace("/(auth)/sign-in"), 1500);
        return;
      }

      setErr(`Échec de la réinitialisation (statut: ${signIn.status ?? "inconnu"})`);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setSubmitting(false);
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
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: c.foreground, marginBottom: 8 }}>
            {step === "request" ? "Mot de passe oublié" : "Nouveau mot de passe"}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, lineHeight: 20 }}>
            {step === "request"
              ? "Saisissez l'adresse email associée à votre compte. Nous vous enverrons un code de vérification."
              : `Saisissez le code à 6 chiffres envoyé à ${email.trim()} et choisissez un nouveau mot de passe.`}
          </Text>
        </View>

        {step === "request" ? (
          <>
            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="vous@exemple.com"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </>
        ) : (
          <>
            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>
              Code de vérification
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              placeholder="Code à 6 chiffres"
              placeholderTextColor={c.mutedForeground}
              style={{ ...inputStyle(c), letterSpacing: 2 }}
            />

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>
              Nouveau mot de passe
            </Text>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 caractères"
              placeholderTextColor={c.mutedForeground}
            />

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>
              Confirmer le mot de passe
            </Text>
            <PasswordInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Saisissez à nouveau le mot de passe"
              placeholderTextColor={c.mutedForeground}
            />
          </>
        )}

        {info && (
          <Text style={{ color: c.mutedForeground, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
            {info}
          </Text>
        )}
        {err && (
          <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
            {err}
          </Text>
        )}

        <Pressable
          onPress={step === "request" ? handleRequestCode : handleReset}
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
              {step === "request" ? "Envoyer le code" : "Réinitialiser"}
            </Text>
          )}
        </Pressable>

        {step === "reset" && (
          <Pressable
            onPress={handleResend}
            disabled={busy}
            style={{ marginTop: 16, alignItems: "center" }}
          >
            <Text style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>Renvoyer le code</Text>
          </Pressable>
        )}

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
            Vous vous souvenez de votre mot de passe ?{" "}
          </Text>
          <Link href="/(auth)/sign-in" replace>
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Se connecter</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    backgroundColor: c.card,
    color: c.foreground,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: c.radius,
    padding: 14,
    marginBottom: 16,
    fontFamily: "Inter_400Regular" as const,
  };
}
