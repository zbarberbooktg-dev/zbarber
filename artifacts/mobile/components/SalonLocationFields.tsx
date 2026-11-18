import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import { LocationPickerMap } from "./LocationPickerMap";
import { useColors } from "@/hooks/useColors";

export type SalonCoordinates = { latitude: number; longitude: number };
export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function SalonLocationFields({ value, onChange, disabled = false, onLocatingChange, unsaved = false }: {
  value: SalonCoordinates | null;
  onChange: (value: SalonCoordinates) => void;
  disabled?: boolean;
  onLocatingChange?: (busy: boolean) => void;
  unsaved?: boolean;
}) {
  const c = useColors();
  const [locating, setLocating] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  const capture = async () => {
    setLocating(true); onLocatingChange?.(true); setError(null); setSettingsNeeded(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setSettingsNeeded(!permission.canAskAgain);
        throw new Error("Localisation refusée. Vous pouvez aussi placer le repère manuellement sur la carte.");
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!validCoordinates(coords.latitude, coords.longitude)) throw new Error("Position GPS invalide.");
      onChange({ latitude: coords.latitude, longitude: coords.longitude });
      setRecenterKey((key) => key + 1);
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'obtenir votre position. Placez le repère sur la carte.");
    } finally { setLocating(false); onLocatingChange?.(false); }
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Position du salon sur la carte</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
        {value ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`
          : "Position non définie. Touchez la carte pour placer le salon, ou utilisez le GPS lorsque vous êtes sur place."}
      </Text>
      {unsaved && (
        <Text testID="salon-position-unsaved" style={{ color: c.primary, fontSize: 13, lineHeight: 18 }}>
          Position modifiée. Touchez « Enregistrer » pour confirmer sa sauvegarde.
        </Text>
      )}
      <Pressable testID="salon-capture-gps" onPress={capture} disabled={locating || disabled}
        accessibilityRole="button" accessibilityLabel="Utiliser ma position GPS"
        style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
        {locating ? <ActivityIndicator color={c.primary} /> : <Feather name="crosshair" size={20} color={c.primary} />}
        <Text style={{ color: c.primary }}>Utiliser ma position GPS</Text>
      </Pressable>
      {/* The initial viewport is not saved as the salon's location. Only an
          explicit tap, drag or GPS capture defines persisted coordinates. */}
      <View pointerEvents={disabled || locating ? "none" : "auto"}>
        <LocationPickerMap latitude={value?.latitude ?? 6.1256} longitude={value?.longitude ?? 1.2254}
          recenterKey={recenterKey} tint={c.primary} background={c.background} height={260}
          onChange={(latitude, longitude) => {
            if (validCoordinates(latitude, longitude)) onChange({ latitude, longitude });
          }} />
      </View>
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Déplacez le repère ou touchez la carte pour ajuster la position.</Text>
      {error && <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text>}
      {settingsNeeded && Platform.OS !== "web" && (
        <Pressable onPress={() => { Linking.openSettings().catch(() => setError("Ouvrez les réglages de localisation de votre appareil.")); }}>
          <Text style={{ color: c.primary }}>Ouvrir les réglages</Text>
        </Pressable>
      )}
    </View>
  );
}
