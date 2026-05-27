import { useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";
import { CountryCityFields } from "@/components/CountryCityFields";
import { PasswordInput } from "@/components/PasswordInput";

type Props = {
  visible: boolean;
  onClose: () => void;
  initialName: string;
  initialPhone: string;
  onSaved?: () => void;
};

export function EditProfileModal({ visible, onClose, initialName, initialPhone, onSaved }: Props) {
  const c = useColors();
  const { user: clerkUser } = useUser();
  const { syncAuth, user, t } = useApp();
  const fetcher = useAuthedFetch();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [city, setCity] = useState(user?.city ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmNewPwd, setConfirmNewPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone(initialPhone);
      setCity(user?.city ?? "");
      setCountry(user?.country ?? "");
      setAvatarUrl(user?.avatarUrl ?? null);
      setAvatarLocalUri(null);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmNewPwd("");
      setErr(null);
      setOk(null);
    }
  }, [visible, initialName, initialPhone, user]);

  const handlePickAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await pickAndUploadImage(fetcher);
      if (res) { setAvatarUrl(res.objectPath); setAvatarLocalUri(res.uri); }
    } catch (e: unknown) {
      setErr(formatApiError(e, t.errors));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      const trimmedCity = city.trim();
      const trimmedCountry = country.trim();

      const changed =
        trimmedName !== initialName ||
        trimmedPhone !== initialPhone ||
        trimmedCity !== (user?.city ?? "") ||
        trimmedCountry !== (user?.country ?? "") ||
        avatarUrl !== (user?.avatarUrl ?? null);

      if (changed) {
        const u = await syncAuth({
          name: trimmedName || undefined,
          phone: trimmedPhone || undefined,
          city: trimmedCity || undefined,
          country: trimmedCountry || undefined,
          avatarUrl: avatarUrl || undefined,
        });
        if (!u) throw new Error(t.errors.syncFailed);

        if (clerkUser && trimmedName) {
          const [firstName, ...rest] = trimmedName.split(/\s+/);
          try {
            await clerkUser.update({
              firstName: firstName || undefined,
              lastName: rest.join(" ") || undefined,
            });
          } catch { /* non-blocking */ }
        }
      }

      if (newPwd) {
        if (newPwd.length < 8) throw new Error(t.errors.invalidInput);
        if (newPwd !== confirmNewPwd) throw new Error((t as any).passwordsDoNotMatch ?? t.errors.invalidInput);
        if (!clerkUser) throw new Error(t.errors.unauthorized);
        await clerkUser.updatePassword({
          currentPassword: currentPwd || undefined,
          newPassword: newPwd,
          signOutOfOtherSessions: true,
        });
      }

      setOk("Profil mis à jour");
      onSaved?.();
      setTimeout(() => onClose(), 600);
    } catch (e: unknown) {
      const clerkMsg = (e as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message;
      setErr(clerkMsg ?? formatApiError(e, t.errors));
    } finally {
      setSaving(false);
    }
  };

  const avatarDisplay = avatarLocalUri ?? resolveObjectUrl(avatarUrl);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Modifier mon profil</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving
              ? <ActivityIndicator color={c.primary} size="small" />
              : <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enregistrer</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={{ alignItems: "center", marginVertical: 6 }}>
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
              {avatarDisplay ? "Changer la photo" : "Ajouter une photo"}
            </Text>
          </View>

          <Field label="Nom complet">
            <TextInput value={name} onChangeText={setName} autoCapitalize="words" placeholder="Prénom Nom" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field label="Téléphone">
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+243 ..." placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <CountryCityFields
            countryName={country}
            cityName={city}
            onChange={({ country: nc, city: nci }) => { setCountry(nc); setCity(nci); }}
          />

          <View style={{ marginTop: 8 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Changer le mot de passe
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12 }}>
              Laissez vide si vous ne souhaitez pas le modifier.
            </Text>
            <Field label="Mot de passe actuel">
              <PasswordInput value={currentPwd} onChangeText={setCurrentPwd} placeholder="••••••••" placeholderTextColor={c.mutedForeground} />
            </Field>
            <Field label="Nouveau mot de passe">
              <PasswordInput value={newPwd} onChangeText={setNewPwd} placeholder="Min. 8 caractères" placeholderTextColor={c.mutedForeground} />
            </Field>
            <Field label="Confirmer le nouveau mot de passe">
              <PasswordInput value={confirmNewPwd} onChangeText={setConfirmNewPwd} placeholder="Saisissez à nouveau" placeholderTextColor={c.mutedForeground} />
            </Field>
          </View>

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}
          {ok && <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{ok}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
    borderRadius: c.radius, padding: 14, fontFamily: "Inter_400Regular" as const,
  };
}
