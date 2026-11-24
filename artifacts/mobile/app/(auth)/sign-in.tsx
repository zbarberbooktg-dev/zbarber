import { useSignIn, useAuth, useClerk } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { consumeAuthIntent } from "@/lib/authIntent";
import { PasswordInput } from "@/components/PasswordInput";
import { ActiveSessionGate, SessionTransition } from "@/components/ActiveSessionGate";
import { authErrorMessage, isSessionConflictError, withDeadline } from "@/lib/sessionLifecycle";
import { salonReservationHref } from "@/lib/reservationRoute";

type MfaStrategy = "totp" | "phone_code" | "email_code" | "backup_code";

export default function SignInScreen() {
  const c = useColors();
  const { t, suspendedNotice, clearSuspendedNotice, signingOut, signOutDestination } = useApp();
  const router = useRouter();
  const { bookingSalon } = useLocalSearchParams<{ bookingSalon?: string }>();
  const signupHref = salonReservationHref(bookingSalon) ? { pathname: "/(auth)/sign-up" as const, params: { bookingSalon } } : "/(auth)/sign-up";
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const submitLock = useRef(false);
  const sessionNavigation = useRef({ signingOut, signOutDestination });
  sessionNavigation.current = { signingOut, signOutDestination };
  const busy = isSubmitting || fetchStatus === "fetching";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(
    suspendedNotice ? (t as any).accountSuspendedNotice : null,
  );
  const [intent] = useState(() => consumeAuthIntent());
  const scrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    if (suspendedNotice && !isSignedIn) {
      setSubmitError(t.accountSuspendedNotice);
      clearSuspendedNotice();
    }
    if (!isSignedIn && !signingOut && signOutDestination) setSessionConflict(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspendedNotice, isSignedIn, signingOut, signOutDestination]);

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [verificationKind, setVerificationKind] = useState<"mfa" | "client_trust">("mfa");
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [availableStrategies, setAvailableStrategies] = useState<MfaStrategy[]>([]);
  const [info, setInfo] = useState<string | null>(null);

  if (!isLoaded || signingOut) return <SessionTransition signingOut={signingOut} />;
  if (isSignedIn || clerk.session || sessionConflict) return <ActiveSessionGate bookingSalon={bookingSalon} />;
  if (intent === "signup") return <Redirect href={signupHref} />;

  const enterMfa = async () => {
    setVerificationKind("mfa");
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
      if (error) setSubmitError(authErrorMessage(error, "Impossible d'envoyer le code SMS."));
      else setInfo("Code envoyé par SMS");
    } else if (preferred === "email_code") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) setSubmitError(authErrorMessage(error, "Impossible d'envoyer le code par email."));
      else setInfo("Code envoyé par email");
    }
  };

  const enterClientTrust = async () => {
    const factors = (signIn.supportedSecondFactors ?? []) as Array<{ strategy: string }>;
    const supportsEmailCode = factors.some((factor) => factor.strategy === "email_code");
    if (!supportsEmailCode) {
      showError(
        "Cet appareil doit être vérifié, mais aucune vérification par email n'est disponible. Réessayez plus tard ou contactez l'assistance.",
      );
      return;
    }

    setVerificationKind("client_trust");
    setAvailableStrategies(["email_code"]);
    setMfaStrategy("email_code");
    setStep("mfa");
    setMfaCode("");
    setInfo(null);

    const { error } = await signIn.mfa.sendEmailCode();
    if (error) {
      showError(authErrorMessage(error, "Impossible d'envoyer le code de vérification par email."));
      return;
    }
    setInfo("Un code de vérification a été envoyé par email.");
  };

  const switchStrategy = async (next: MfaStrategy) => {
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      setSubmitError(null);
      setInfo(null);
      setMfaCode("");
      setMfaStrategy(next);
      if (next === "phone_code") {
        const { error } = await signIn.mfa.sendPhoneCode();
        if (error) setSubmitError(authErrorMessage(error, "Impossible d'envoyer le code SMS."));
        else setInfo("Code envoyé par SMS");
      } else if (next === "email_code") {
        const { error } = await signIn.mfa.sendEmailCode();
        if (error) setSubmitError(authErrorMessage(error, "Impossible d'envoyer le code par email."));
        else setInfo("Code envoyé par email");
      }
    } catch { showError("Impossible d'envoyer le code. Vérifiez votre connexion."); }
    finally { submitLock.current = false; setIsSubmitting(false); }
  };

  const showError = (msg: string) => {
    setSubmitError(msg);
    // Dismiss keyboard so the error text is not hidden beneath it on Android,
    // then scroll to the top so the message is visible.
    Keyboard.dismiss();
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 120);
  };

  const reportAuthError = async (error: unknown, fallback: string) => {
    if (isSessionConflictError(error)) {
      setSessionConflict(true);
      try {
        await withDeadline(async (signal) => {
          const client = await clerk.client?.reload();
          const active = clerk.session ?? client?.sessions.find((session) => session.status === "active");
          const leaving = sessionNavigation.current;
          if (active && !signal.aborted && !leaving.signingOut && !leaving.signOutDestination) await clerk.setActive({ session: active.id });
        }, 5000, "Session indisponible");
      } catch { /* ActiveSessionGate offers explicit retry or SDK sign-out. */ }
      return;
    }
    showError(authErrorMessage(error, fallback));
  };

  const finalizeSession = async () => {
    const { error } = await signIn.finalize({ navigate: () => {} });
    if (error) await reportAuthError(error, "Impossible d'activer la session. Veuillez réessayer.");
  };

  const handleSubmit = async () => {
    if (submitLock.current || busy || !isLoaded || signingOut) return;
    if (clerk.session || isSignedIn) { setSessionConflict(true); return; }
    setSubmitError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      showError("Veuillez saisir votre email et votre mot de passe");
      return;
    }
    if (!signIn) {
      showError("Authentification en cours d'initialisation, veuillez patienter et réessayer.");
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    const slowTimer = setTimeout(() => setInfo("Votre connexion est lente. La demande est toujours en cours ; ne la renvoyez pas."), 15000);
    try {
      const result = await signIn.password({ identifier: trimmed, password });
      const { error } = result as { error: any };
      if (error) {
        await reportAuthError(error, "Email ou mot de passe incorrect.");
        return;
      }
      if (signIn.status === "complete") {
        await finalizeSession();
        return;
      }
      if (signIn.status === "needs_second_factor") {
        await enterMfa();
        return;
      }
      if (signIn.status === "needs_client_trust") {
        await enterClientTrust();
        return;
      }
      const fieldErr =
        (errors as any)?.fields?.identifier?.message ||
        (errors as any)?.fields?.password?.message ||
        (errors as any)?.global?.[0]?.message;
      showError(
        fieldErr ? authErrorMessage({ message: fieldErr }, "Connexion impossible. Veuillez réessayer.") :
          "Une vérification supplémentaire est nécessaire. Veuillez réessayer la connexion.",
      );
    } catch (err: any) {
      await reportAuthError(err, "Impossible de vous connecter. Vérifiez votre connexion et réessayez.");
    } finally {
      clearTimeout(slowTimer);
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async () => {
    if (submitLock.current || busy || !isLoaded || signingOut) return;
    setSubmitError(null);
    setInfo(null);
    const code = mfaCode.trim();
    if (!code) {
      showError("Veuillez saisir le code de vérification");
      return;
    }
    if (!signIn) {
      showError("Authentification en cours d'initialisation, veuillez réessayer.");
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    const slowTimer = setTimeout(() => setInfo("La vérification prend plus de temps. La demande est toujours en cours ; ne la renvoyez pas."), 15000);
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
        await reportAuthError(res.error, "Code invalide ou expiré.");
        return;
      }
      if (signIn.status === "complete") {
        await finalizeSession();
        return;
      }
      showError("La vérification n’est pas terminée. Vérifiez le code et réessayez.");
    } catch (err: any) {
      await reportAuthError(err, "Impossible de vérifier le code. Vérifiez votre connexion.");
    } finally {
      clearTimeout(slowTimer);
      submitLock.current = false;
      setIsSubmitting(false);
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Pressable
        onPress={() => router.replace("/")}
        hitSlop={10}
        style={{
          position: "absolute", top: 52, left: 24, zIndex: 10,
          flexDirection: "row", alignItems: "center", gap: 6,
        }}
      >
        <Feather name="arrow-left" size={18} color={c.primary} />
        <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
          {(t as any).backToHome ?? "Accueil"}
        </Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 96, paddingBottom: 96 }}
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
                Connectez-vous à votre compte Zbarber
              </Text>
            </View>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Email</Text>
            <TextInput
              testID="sign-in-email"
              editable={!busy}
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
              editable={!busy}
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
                {verificationKind === "client_trust"
                  ? "Vérifiez ce nouvel appareil"
                  : "Vérification en deux étapes"}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                {verificationKind === "client_trust"
                  ? "Pour sécuriser votre compte, saisissez le code reçu par email."
                  : mfaStrategy === "totp"
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
              testID="sign-in-verification-code"
              editable={!busy}
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

          </>
        )}

        {info && <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>{info}</Text>}
        {(() => {
          const signalErr =
            (errors as any)?.fields?.identifier?.message ||
            (errors as any)?.fields?.password?.message ||
            (errors as any)?.fields?.code?.message ||
            (errors as any)?.global?.[0]?.message;
          const msg = submitError || (signalErr ? authErrorMessage({ message: signalErr }, "Authentification impossible. Vérifiez vos informations et réessayez.") : null);
          return msg ? (
            <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
              {msg}
            </Text>
          ) : null;
        })()}

        <Pressable
          testID="sign-in-submit"
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

        {step === "mfa" && verificationKind === "mfa" && availableStrategies.length > 1 && (
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
            disabled={busy}
            onPress={() => {
              setStep("credentials");
              setVerificationKind("mfa");
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
              <Link href="/(auth)/forgot-password" asChild>
                <Pressable disabled={busy}>
                <Text style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>
                  Mot de passe oublié ?
                </Text>
                </Pressable>
              </Link>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Pas de compte ? </Text>
              <Link href={signupHref} replace asChild>
                <Pressable disabled={busy}>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>S'inscrire</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
