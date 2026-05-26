import { useSignUp, useAuth } from "@clerk/expo";
import { Link, Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";
import { CountryCityFields } from "@/components/CountryCityFields";

type Role = "client" | "barber";
type Step = "details" | "verify";

export default function SignUpScreen() {
  const c = useColors();
  const { syncAuth, t } = useApp();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const fetcher = useAuthedFetch();

  const [role, setRole] = useState<Role>("client");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("details");
  const [err, setErr] = useState<string | null>(null);

  if (isSignedIn && step !== "verify") {
    return <Redirect href="/" />;
  }

  const busy = fetchStatus === "fetching";

  const handlePickAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await pickAndUploadImage(fetcher);
      if (res) { setAvatarUrl(res.objectPath); setAvatarLocalUri(res.uri); }
    } catch (e: any) {
      setErr(e?.message ?? "Échec de l'envoi de la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openTerms = () => router.push("/legal/terms");
  const openPrivacy = () => router.push("/legal/privacy");

  const handleStart = async () => {
    setErr(null);
    if (password !== confirmPassword) {
      setErr((t as any).passwordsDoNotMatch ?? "Les mots de passe ne correspondent pas");
      return;
    }
    if (!acceptedTerms) {
      setErr((t as any).mustAcceptTerms ?? "Vous devez accepter les conditions");
      return;
    }
    try {
      const trimmedName = name.trim();
      const [firstName, ...rest] = trimmedName.split(/\s+/);
      const lastName = rest.join(" ");
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        unsafeMetadata: { role, phone: phone.trim() },
      });
      if (error) { setErr(error.message ?? "Erreur d'inscription"); return; }
      await signUp.verifications.sendEmailCode();
      setStep("verify");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur d'inscription");
    }
  };

  const handleVerify = async () => {
    setErr(null);
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async () => {
            await syncAuth({
              role,
              name: name.trim() || undefined,
              phone: phone.trim() || undefined,
              city: city.trim() || undefined,
              country: country.trim() || undefined,
              avatarUrl: avatarUrl || undefined,
            });
            router.replace("/");
          },
        });
      } else {
        setErr("Vérification incomplète");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Code invalide");
    }
  };

  const RoleButton = ({ value, title, subtitle }: { value: Role; title: string; subtitle: string }) => (
    <Pressable
      onPress={() => setRole(value)}
      style={{
        flex: 1, padding: 16, borderRadius: c.radius, borderWidth: 2,
        borderColor: role === value ? c.primary : c.border,
        backgroundColor: role === value ? c.primary + "15" : c.card,
      }}
    >
      <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground, marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, fontSize: 12 }}>{subtitle}</Text>
    </Pressable>
  );

  const avatarDisplay = avatarLocalUri ?? resolveObjectUrl(avatarUrl);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 56, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {step === "details" ? (
          <>
            <View style={{ marginBottom: 28 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: c.foreground, marginBottom: 8 }}>
                Créer un compte
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                Rejoignez la plateforme Global Barber
              </Text>
            </View>

            {/* Avatar picker */}
            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <Pressable
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                style={{
                  width: 96, height: 96, borderRadius: 48, borderWidth: 2,
                  borderColor: c.border, alignItems: "center", justifyContent: "center",
                  overflow: "hidden", backgroundColor: c.card,
                }}
              >
                {avatarDisplay ? (
                  <Image source={{ uri: avatarDisplay }} style={{ width: "100%", height: "100%" }} />
                ) : uploadingAvatar ? (
                  <ActivityIndicator color={c.primary} />
                ) : (
                  <Feather name="camera" size={28} color={c.mutedForeground} />
                )}
              </Pressable>
              <Text style={{ marginTop: 8, color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {avatarDisplay ? "Changer la photo" : "Ajouter une photo (optionnel)"}
              </Text>
            </View>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 8 }}>Je suis</Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
              <RoleButton value="client" title="Client" subtitle="Réserver un barbier" />
              <RoleButton value="barber" title="Barbier" subtitle="Gérer mon salon" />
            </View>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Nom complet</Text>
            <TextInput value={name} onChangeText={setName} autoCapitalize="words" placeholder="Prénom Nom" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Téléphone</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+243 ..." placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />

            <View style={{ marginBottom: 12 }}>
              <CountryCityFields
                countryName={country}
                cityName={city}
                onChange={({ country: nc, city: nci }: { country: string; city: string }) => { setCountry(nc); setCity(nci); }}
              />
            </View>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="vous@exemple.com" placeholderTextColor={c.mutedForeground} style={{ ...inputStyle(c), marginBottom: 6 }} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 16, lineHeight: 16 }}>
              ⚠️ Utilisez une adresse email réelle : un code de vérification vous sera envoyé pour activer votre compte.
            </Text>

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>Mot de passe</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Min. 8 caractères" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />

            <Text style={{ fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 }}>
              {(t as any).confirmPassword ?? "Confirmer le mot de passe"}
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder={(t as any).confirmPasswordPh ?? "Saisissez à nouveau le mot de passe"}
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />

            {/* CGU + privacy checkbox */}
            <Pressable
              onPress={() => setAcceptedTerms((v) => !v)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16, paddingVertical: 4 }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: acceptedTerms ? c.primary : c.border,
                  backgroundColor: acceptedTerms ? c.primary : "transparent",
                  alignItems: "center", justifyContent: "center", marginTop: 2,
                }}
              >
                {acceptedTerms && <Feather name="check" size={14} color={c.primaryForeground} />}
              </View>
              <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
                {(t as any).acceptTermsPrefix ?? "J'accepte les "}
                <Text onPress={openTerms} style={{ color: c.primary, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" }}>
                  {(t as any).acceptTermsLink ?? "Conditions d'utilisation"}
                </Text>
                {(t as any).acceptTermsAnd ?? " et la "}
                <Text onPress={openPrivacy} style={{ color: c.primary, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" }}>
                  {(t as any).acceptPrivacyLink ?? "Politique de confidentialité"}
                </Text>
                .
              </Text>
            </Pressable>

            {(err || (errors as any)?.raw?.[0]?.message) && (
              <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>
                {err || (errors as any)?.raw?.[0]?.message}
              </Text>
            )}

            <Pressable
              onPress={handleStart}
              disabled={busy || !email || !name.trim() || !phone.trim() || password.length < 8 || !confirmPassword || !acceptedTerms}
              style={({ pressed }) => ({
                backgroundColor: c.primary, padding: 16, borderRadius: c.radius, alignItems: "center",
                opacity: busy || !email || !name.trim() || !phone.trim() || password.length < 8 || !confirmPassword || !acceptedTerms ? 0.6 : pressed ? 0.85 : 1,
              })}
            >
              {busy ? <ActivityIndicator color={c.primaryForeground} /> : (
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Continuer</Text>
              )}
            </Pressable>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Déjà un compte ? </Text>
              <Link href="/(auth)/sign-in" replace>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Se connecter</Text>
              </Link>
            </View>
          </>
        ) : (
          <>
            <View style={{ marginBottom: 28 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: c.foreground, marginBottom: 8 }}>Vérifiez votre email</Text>
              <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Entrez le code envoyé à {email}</Text>
            </View>
            <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="Code à 6 chiffres" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
            {(err || (errors as any)?.raw?.[0]?.message) && (
              <Text style={{ color: c.destructive, marginBottom: 12, fontFamily: "Inter_400Regular" }}>{err || (errors as any)?.raw?.[0]?.message}</Text>
            )}
            <Pressable
              onPress={handleVerify}
              disabled={busy || code.length < 4}
              style={({ pressed }) => ({
                backgroundColor: c.primary, padding: 16, borderRadius: c.radius, alignItems: "center",
                opacity: busy || code.length < 4 ? 0.6 : pressed ? 0.85 : 1,
              })}
            >
              {busy ? <ActivityIndicator color={c.primaryForeground} /> : (
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Vérifier</Text>
              )}
            </Pressable>
            <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>Renvoyer le code</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
    borderRadius: c.radius, padding: 14, marginBottom: 16, fontFamily: "Inter_400Regular" as const,
  };
}
