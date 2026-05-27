import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

type Country = { id: number; code: string; name: string; dialCode: string | null };
type City = { id: number; countryId: number; name: string };

type Props = {
  countryName: string;
  cityName: string;
  onChange: (next: { country: string; city: string }) => void;
  countryLabel?: string;
  cityLabel?: string;
  required?: boolean;
  lockCountry?: boolean;
};

export function CountryCityFields({
  countryName, cityName, onChange,
  countryLabel = "Pays", cityLabel = "Ville", required,
  lockCountry,
}: Props) {
  const c = useColors();
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(cityName);
  const [cityFocused, setCityFocused] = useState(false);
  const [cityOptions, setCityOptions] = useState<City[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityFetchSeq = useRef(0);

  // Load countries once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/countries"));
        if (res.ok) setCountries(await res.json());
      } catch { /* offline-safe */ }
    })();
  }, []);

  // Always re-derive selectedCountry from the incoming prop so the field stays
  // controlled (handles modal reopen, parent refetch, switching editing targets).
  useEffect(() => {
    if (!countries) return;
    if (!countryName) { setSelectedCountry(null); return; }
    const match = countries.find(
      (k) => k.name.toLowerCase() === countryName.toLowerCase() ||
             k.code.toLowerCase() === countryName.toLowerCase(),
    );
    setSelectedCountry(match ?? null);
  }, [countries, countryName]);

  // Sync city if parent updates it externally
  useEffect(() => { setCity(cityName); }, [cityName]);

  // Fetch cities when country changes or city text changes
  useEffect(() => {
    if (!selectedCountry) { setCityOptions([]); return; }
    const seq = ++cityFetchSeq.current;
    setCityLoading(true);
    const q = city.trim();
    const url = `/api/countries/${selectedCountry.id}/cities${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    fetch(apiUrl(url))
      .then((r) => r.ok ? r.json() : [])
      .then((rows: City[]) => {
        if (seq !== cityFetchSeq.current) return;
        setCityOptions(rows);
      })
      .catch(() => { if (seq === cityFetchSeq.current) setCityOptions([]); })
      .finally(() => { if (seq === cityFetchSeq.current) setCityLoading(false); });
  }, [selectedCountry, city]);

  const handlePickCountry = (k: Country) => {
    // Clear the city when country changes to prevent cross-country mismatches.
    const nextCity = selectedCountry && selectedCountry.id === k.id ? city : "";
    setSelectedCountry(k);
    setCity(nextCity);
    setPickerOpen(false);
    setSearch("");
    onChange({ country: k.name, city: nextCity });
  };

  const handleCityChange = (text: string) => {
    setCity(text);
    onChange({ country: selectedCountry?.name ?? countryName, city: text });
  };

  const handlePickCitySuggestion = (cityRow: City) => {
    setCity(cityRow.name);
    setCityFocused(false);
    onChange({ country: selectedCountry?.name ?? countryName, city: cityRow.name });
  };

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    const s = search.trim().toLowerCase();
    if (!s) return countries;
    return countries.filter((k) => k.name.toLowerCase().includes(s) || k.code.toLowerCase().includes(s));
  }, [countries, search]);

  const showSuggestions =
    cityFocused && selectedCountry &&
    (cityOptions.length > 0 || cityLoading) &&
    !(cityOptions.length === 1 && cityOptions[0].name.toLowerCase() === city.trim().toLowerCase());

  return (
    <View style={{ gap: 12 }}>
      {/* Country select */}
      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
          {countryLabel}{required ? " *" : ""}
        </Text>
        <Pressable
          onPress={() => { if (!lockCountry) setPickerOpen(true); }}
          disabled={lockCountry}
          style={{
            backgroundColor: lockCountry ? c.muted : c.card,
            borderWidth: 1, borderColor: c.border,
            borderRadius: c.radius, padding: 14, flexDirection: "row",
            alignItems: "center", justifyContent: "space-between",
            opacity: lockCountry ? 0.85 : 1,
          }}
        >
          <Text style={{
            color: selectedCountry ? c.foreground : c.mutedForeground,
            fontFamily: "Inter_400Regular", fontSize: 15, flex: 1,
          }} numberOfLines={1}>
            {selectedCountry
              ? selectedCountry.name
              : (countryName || (countries ? "Sélectionnez un pays" : "Chargement…"))}
          </Text>
          {lockCountry
            ? <Feather name="lock" size={16} color={c.mutedForeground} />
            : <Feather name="chevron-down" size={18} color={c.mutedForeground} />}
        </Pressable>
      </View>

      {/* City autocomplete */}
      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
          {cityLabel}{required ? " *" : ""}
        </Text>
        <TextInput
          value={city}
          onChangeText={handleCityChange}
          onFocus={() => setCityFocused(true)}
          onBlur={() => setTimeout(() => setCityFocused(false), 150)}
          autoCapitalize="words"
          editable={!!selectedCountry}
          placeholder={selectedCountry ? "Kinshasa" : "Choisissez un pays d'abord"}
          placeholderTextColor={c.mutedForeground}
          style={{
            backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
            borderRadius: c.radius, padding: 14, fontFamily: "Inter_400Regular",
            opacity: selectedCountry ? 1 : 0.6,
          }}
        />
        {showSuggestions && (
          <View style={{
            marginTop: 4, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
            borderRadius: c.radius, maxHeight: 180, overflow: "hidden",
          }}>
            {cityLoading && cityOptions.length === 0 ? (
              <View style={{ padding: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color={c.primary} />
              </View>
            ) : (
              cityOptions.slice(0, 8).map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => handlePickCitySuggestion(opt)}
                  style={({ pressed }) => ({
                    padding: 12, borderBottomWidth: 1, borderBottomColor: c.border,
                    backgroundColor: pressed ? c.muted : "transparent",
                  })}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                    {opt.name}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* Country picker modal */}
      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View style={{
            flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border,
            alignItems: "center", justifyContent: "space-between",
          }}>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
            </Pressable>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Choisir un pays</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={{ padding: 12 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              autoFocus
              placeholder="Rechercher un pays…"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              style={{
                backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
                borderRadius: c.radius, padding: 12, fontFamily: "Inter_400Regular",
              }}
            />
          </View>

          {!countries ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handlePickCountry(item)}
                  style={({ pressed }) => ({
                    padding: 14, borderBottomWidth: 1, borderBottomColor: c.border,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    backgroundColor: pressed ? c.muted : "transparent",
                  })}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                    {item.name}
                  </Text>
                  {item.dialCode && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                      {item.dialCode}
                    </Text>
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: c.mutedForeground, padding: 24, textAlign: "center" }}>
                  Aucun pays trouvé
                </Text>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
