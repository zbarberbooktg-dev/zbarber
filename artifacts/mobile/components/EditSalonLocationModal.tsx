import { useUpdateMySalon } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";
import { refreshSalonDiscovery } from "@/lib/salonDiscovery";
import { SalonLocationFields, type SalonCoordinates, validCoordinates } from "./SalonLocationFields";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { CountryCityFields } from "@/components/CountryCityFields";

type Props = {
  visible: boolean;
  onClose: () => void;
  initial: {
    country?: string | null;
    city?: string | null;
    neighborhood?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    logoUrl?: string | null;
  };
  onSaved?: () => void;
};

export function EditSalonLocationModal({ visible, onClose, initial, onSaved }: Props) {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const update = useUpdateMySalon();
  const [coordinates, setCoordinates] = useState<SalonCoordinates | null>(() =>
    validCoordinates(initial.latitude, initial.longitude) ? { latitude: initial.latitude!, longitude: initial.longitude! } : null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [country, setCountry] = useState(initial.country ?? "Togo");
  const [city, setCity] = useState(initial.city ?? "Lomé");
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "+228 ");
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "+228 ");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mounted only while open by the profile: each opening uses the latest
  // persisted values, without a background refetch clobbering edits.
  const chooseLogo = async () => {
    setUploading(true); setErr(null);
    try {
      const result = await pickAndUploadImage(fetcher);
      if (result) { setLogoUrl(result.objectPath); setLogoPreview(result.uri); }
    } catch (e: any) { setErr(e?.message ?? "Impossible d'ajouter le logo."); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setErr(null);
    if (!country.trim()) {
      setErr("Le pays est obligatoire");
      return;
    }
    if (!city.trim()) {
      setErr("La ville est obligatoire");
      return;
    }
    setSaving(true);
    try {
      await update.mutateAsync({ data: {
          country: country.trim(),
          city: city.trim(),
          neighborhood: neighborhood.trim(),
          address: address.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          logoUrl,
          ...(coordinates ?? {}),
      } });
      await refreshSalonDiscovery(qc);
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
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} disabled={saving || uploading || locating} hitSlop={10}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Mon salon</Text>
          <Pressable testID="salon-save" onPress={handleSave} disabled={saving || uploading || locating} hitSlop={10}>
            {saving ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enregistrer</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
          bottomOffset={32}
        >
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
            Mettez à jour l'adresse de votre salon si vous avez déménagé. Vos clients verront immédiatement la nouvelle localisation.
          </Text>

          <CountryCityFields
            required
            countryName={country}
            cityName={city}
            onChange={({ country: nc, city: nci }) => { setCountry(nc); setCity(nci); }}
          />

          <View style={{ gap: 10 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>Logo du salon (facultatif)</Text>
            {(logoPreview || resolveObjectUrl(logoUrl)) && (
              <Image source={{ uri: logoPreview || resolveObjectUrl(logoUrl)! }} style={{ width: 96, height: 96, borderRadius: c.radius }} />
            )}
            <Pressable testID="salon-pick-logo" onPress={chooseLogo} disabled={uploading || saving}>
              {uploading ? <ActivityIndicator color={c.primary} /> : <Text style={{ color: c.primary }}>{logoUrl ? "Remplacer le logo" : "Ajouter un logo"}</Text>}
            </Pressable>
            {logoUrl && <Pressable testID="salon-remove-logo" disabled={uploading || saving} onPress={() => { setLogoUrl(null); setLogoPreview(null); }}>
              <Text style={{ color: c.destructive }}>Retirer le logo</Text>
            </Pressable>}
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Sans logo, la première photo de votre galerie représente le salon.</Text>
          </View>
          <SalonLocationFields value={coordinates} onChange={setCoordinates} disabled={saving} onLocatingChange={setLocating} />

          <Field label="Quartier">
            <TextInput
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="Bè"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="Adresse complète">
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Bd du 13 Janvier, Lomé"
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
              placeholder="+228 ..."
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          <Field label="WhatsApp">
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              placeholder="+228 ..."
              placeholderTextColor={c.mutedForeground}
              style={inputStyle(c)}
            />
          </Field>

          {err && (
            <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>
          )}
        </KeyboardAwareScrollViewCompat>
      </View>
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
