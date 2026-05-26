import { useUser } from "@clerk/expo";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
  const { syncAuth } = useApp();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone(initialPhone);
      setCurrentPwd("");
      setNewPwd("");
      setErr(null);
      setOk(null);
    }
  }, [visible, initialName, initialPhone]);

  const handleSave = async () => {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      const changedProfile = trimmedName !== initialName || trimmedPhone !== initialPhone;

      if (changedProfile) {
        const u = await syncAuth({
          name: trimmedName || undefined,
          phone: trimmedPhone || undefined,
        });
        if (!u) throw new Error("Échec de la mise à jour du profil");

        if (clerkUser && trimmedName) {
          const [firstName, ...rest] = trimmedName.split(/\s+/);
          try {
            await clerkUser.update({
              firstName: firstName || undefined,
              lastName: rest.join(" ") || undefined,
            });
          } catch {
            // Non-blocking: local DB is the source of truth for display name
          }
        }
      }

      if (newPwd) {
        if (newPwd.length < 8) throw new Error("Le nouveau mot de passe doit faire au moins 8 caractères");
        if (!clerkUser) throw new Error("Utilisateur non disponible");
        await clerkUser.updatePassword({
          currentPassword: currentPwd || undefined,
          newPassword: newPwd,
          signOutOfOtherSessions: true,
        });
      }

      setOk("Profil mis à jour");
      onSaved?.();
      setTimeout(() => onClose(), 600);
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message ?? e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Modifier mon profil</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enregistrer</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Nom complet">
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Prénom Nom"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="Téléphone">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+243 ..."
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <View style={{ marginTop: 8 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Changer le mot de passe
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12 }}>
              Laissez vide si vous ne souhaitez pas le modifier.
            </Text>
            <Field label="Mot de passe actuel">
              <TextInput
                value={currentPwd}
                onChangeText={setCurrentPwd}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle(c)}
              />
            </Field>
            <Field label="Nouveau mot de passe">
              <TextInput
                value={newPwd}
                onChangeText={setNewPwd}
                secureTextEntry
                placeholder="Min. 8 caractères"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle(c)}
              />
            </Field>
          </View>

          {err && (
            <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>
          )}
          {ok && (
            <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{ok}</Text>
          )}
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
    backgroundColor: c.card,
    color: c.foreground,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: c.radius,
    padding: 14,
    fontFamily: "Inter_400Regular" as const,
  };
}
