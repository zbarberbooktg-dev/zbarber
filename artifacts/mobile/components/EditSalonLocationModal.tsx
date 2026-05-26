import { useAuth } from "@clerk/expo";
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

import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  onClose: () => void;
  initial: {
    city?: string | null;
    neighborhood?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  };
  onSaved?: () => void;
};

export function EditSalonLocationModal({ visible, onClose, initial, onSaved }: Props) {
  const c = useColors();
  const { getToken } = useAuth();
  const [city, setCity] = useState(initial.city ?? "");
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setCity(initial.city ?? "");
      setNeighborhood(initial.neighborhood ?? "");
      setAddress(initial.address ?? "");
      setPhone(initial.phone ?? "");
      setWhatsapp(initial.whatsapp ?? "");
      setErr(null);
    }
  }, [visible, initial.city, initial.neighborhood, initial.address, initial.phone, initial.whatsapp]);

  const handleSave = async () => {
    setErr(null);
    if (!city.trim()) {
      setErr("La ville est obligatoire");
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/barbers/me`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          city: city.trim(),
          neighborhood: neighborhood.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur lors de la mise à jour");
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
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
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Localisation du salon</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enregistrer</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
            Mettez à jour l'adresse de votre salon si vous avez déménagé. Vos clients verront immédiatement la nouvelle localisation.
          </Text>

          <Field label="Ville *">
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Kinshasa"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="Quartier">
            <TextInput
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="Gombe"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="Adresse complète">
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Av. Kasa-Vubu n°12"
              placeholderTextColor={c.mutedForeground}
              multiline
              style={[inputStyle(c), { minHeight: 70, textAlignVertical: "top" }]}
            />
          </Field>

          <Field label="Téléphone du salon">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+243 ..."
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="WhatsApp">
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              placeholder="+243 ..."
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          {err && (
            <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>
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
