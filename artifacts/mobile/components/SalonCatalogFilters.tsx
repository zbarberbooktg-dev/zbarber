import { Feather } from "@expo/vector-icons";
import type { SalonCatalogLocation } from "@workspace/api-client-react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Coordinates } from "@/lib/salonSearch";
import * as Location from "expo-location";

export type CatalogFilter = {
  country?: string; city?: string; minPrice?: number; maxPrice?: number;
  radiusKm?: number; origin?: Coordinates;
};

const radii = ["2", "5", "10", "25", "50", "100"];
const parsePrice = (text: string) => {
  const value = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!value) return undefined;
  return /^\d+(\.\d+)?$/.test(value) && Number(value) <= Number.MAX_SAFE_INTEGER ? Number(value) : NaN;
};

export function SalonCatalogFilters({ filter, onChange, locations, locationError, onRetry, fr }: {
  filter: CatalogFilter; onChange: (filter: CatalogFilter) => void;
  locations: SalonCatalogLocation[]; locationError: boolean; onRetry: () => void; fr: boolean;
}) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [priceError, setPriceError] = useState("");
  const countries = Array.from(new Set(locations.flatMap((item) => item.country ? [item.country] : []))).sort((a,b) => a.localeCompare(b));
  const cities = Array.from(new Set(locations.filter((item) => !filter.country || item.country === filter.country).map((item) => item.city).filter(Boolean))).sort((a,b) => a.localeCompare(b));
  const selectedCount = Number(!!filter.country) + Number(!!filter.city) + Number(!!filter.radiusKm) + Number(filter.minPrice !== undefined || filter.maxPrice !== undefined);

  async function distance(value: string) {
    setGpsError("");
    if (!value) { onChange({ ...filter, radiusKm: undefined, origin: undefined }); return; }
    if (filter.origin) { onChange({ ...filter, radiusKm: Number(value) }); return; }
    setLocating(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setGpsError(fr ? "Autorisez la localisation pour filtrer par distance." : "Allow location access to filter by distance."); return; }
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Location timeout")), 12_000); }),
      ]);
      onChange({ ...filter, radiusKm: Number(value), origin: { lat: current.coords.latitude, lng: current.coords.longitude } });
    } catch {
      setGpsError(fr ? "Position indisponible. Vérifiez que le GPS est activé et réessayez." : "Location unavailable. Check that GPS is enabled and try again.");
    } finally {
      if (timer) clearTimeout(timer);
      setLocating(false);
    }
  }

  function applyPrice() {
    const minPrice = parsePrice(min), maxPrice = parsePrice(max);
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
      setPriceError(fr ? "Saisissez des montants valides : le minimum ne doit pas dépasser le maximum." : "Enter valid amounts: the minimum cannot exceed the maximum.");
      return;
    }
    setPriceError("");
    onChange({ ...filter, minPrice, maxPrice });
  }

  function choices(label: string, values: string[], active: string | undefined, onPick: (v: string) => void, unit = "", all = fr ? "Tous" : "All") {
    return <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 7, paddingRight: 6 }}>
        {["", ...values].map((value) => {
          const selected = (active ?? "") === value;
          return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected, disabled: locating }} disabled={locating}
            onPress={() => onPick(value)} style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.accent : c.background }]}>
            <Text style={{ color: selected ? c.accentForeground : c.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{value ? `${value}${unit}` : all}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>;
  }

  return <View style={{ marginTop: 12, gap: 10 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} testID="catalog-filters-toggle"
        onPress={() => setExpanded(!expanded)} style={[styles.chip, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <Feather name="sliders" size={15} color={c.primary} />
        <Text style={[styles.label, { color: c.foreground }]}>{fr ? "Filtres" : "Filters"}{selectedCount > 0 ? ` (${selectedCount})` : ""}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
      </Pressable>
      {selectedCount > 0 && <Pressable accessibilityRole="button" disabled={locating} style={{ paddingVertical: 10 }} onPress={() => {
        setMin(""); setMax(""); setPriceError(""); setGpsError(""); onChange({});
      }}><Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>{fr ? "Réinitialiser" : "Reset"}</Text></Pressable>}
    </View>
    {expanded && <View style={{ borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13, gap: 13 }}>
      {locationError && <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={{ color: c.primary }}>{fr ? "Pays et villes indisponibles. Réessayer." : "Could not load countries and cities. Retry."}</Text>
      </Pressable>}
      {choices(fr ? "Pays" : "Country", countries, filter.country, (v) => onChange({ ...filter, country: v || undefined, city: undefined }))}
      {choices(fr ? "Ville" : "City", cities, filter.city, (v) => onChange({ ...filter, city: v || undefined }), "", fr ? "Toutes" : "All")}
      {choices(fr ? "Distance à vol d’oiseau" : "Straight-line distance", radii, filter.radiusKm?.toString(), (v) => void distance(v), " km", fr ? "Sans limite" : "Any distance")}
      {(locating || gpsError) && <Text accessibilityLiveRegion="polite" style={{ color: c.mutedForeground, fontSize: 12 }}>
        {locating ? (fr ? "Recherche de votre position…" : "Finding your location…") : gpsError}
      </Text>}
      <Text style={[styles.label, { color: c.foreground }]}>{fr ? "Prix d’un service (FC)" : "Service price (FC)"}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ value: min, set: setMin, label: "Minimum" }, { value: max, set: setMax, label: "Maximum" }].map(({ value, set, label }) =>
          <TextInput key={label} accessibilityLabel={label} placeholder={label} placeholderTextColor={c.mutedForeground}
            value={value} onChangeText={set} maxLength={18} keyboardType="decimal-pad" editable={!locating}
            style={[styles.chip, { flex: 1, minWidth: 0, borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />)}
      </View>
      <Pressable accessibilityRole="button" disabled={locating} onPress={applyPrice} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
        <Text style={[styles.label, { color: c.primary }]}>{fr ? "Appliquer le prix" : "Apply price range"}</Text>
      </Pressable>
      {!!priceError && <Text accessibilityLiveRegion="polite" style={{ color: c.destructive, fontSize: 12 }}>{priceError}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  chip: { paddingHorizontal: 11, minHeight: 42, justifyContent: "center", borderRadius: 11, borderWidth: 1 },
});
