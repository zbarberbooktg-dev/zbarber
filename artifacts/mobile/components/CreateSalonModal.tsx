import { useQueryClient } from "@tanstack/react-query";
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
import { useAuthedFetch } from "@/lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (salonId: number) => void;
};

export function CreateSalonModal({ visible, onClose, onCreated }: Props) {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();

  const [salonName, setSalonName] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setSalonName(""); setCity(""); setNeighborhood(""); setAddress("");
      setPhone(""); setWhatsapp(""); setBio(""); setErr(null);
    }
  }, [visible]);

  const handleSave = async () => {
    setErr(null);
    if (salonName.trim().length < 2) return setErr("Le nom du salon est obligatoire (2 caractères min.)");
    if (!city.trim()) return setErr("La ville est obligatoire");
    setSaving(true);
    try {
      const created = await fetcher<{ id: number }>("/api/barbers/me", {
        method: "POST",
        body: JSON.stringify({
          salonName: salonName.trim(),
          city: city.trim(),
          neighborhood: neighborhood.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["barbersMe"] });
      onCreated?.(created.id);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de créer le salon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} hitSlop={10} disabled={saving}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Nouveau salon</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving
              ? <ActivityIndicator color={c.primary} size="small" />
              : <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Créer</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
            Renseignez les informations de base de votre salon. Vous pourrez tout modifier ensuite. Votre salon sera vérifié par l'équipe avant publication.
          </Text>

          <Field label="Nom du salon *">
            <TextInput value={salonName} onChangeText={setSalonName} placeholder="Salon Élégance" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field label="Ville *">
            <TextInput value={city} onChangeText={setCity} placeholder="Kinshasa" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field label="Quartier">
            <TextInput value={neighborhood} onChangeText={setNeighborhood} placeholder="Gombe" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field label="Adresse complète">
            <TextInput value={address} onChangeText={setAddress} placeholder="Av. Kasa-Vubu n°12" placeholderTextColor={c.mutedForeground} multiline style={[inputStyle(c), { minHeight: 60, textAlignVertical: "top" }]} />
          </Field>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Téléphone">
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+243 ..." placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="WhatsApp">
                <TextInput value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="+243 ..." placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
          </View>

          <Field label="Description">
            <TextInput value={bio} onChangeText={setBio} placeholder="Présentez votre salon en quelques mots" placeholderTextColor={c.mutedForeground} multiline style={[inputStyle(c), { minHeight: 80, textAlignVertical: "top" }]} />
          </Field>

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}
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
