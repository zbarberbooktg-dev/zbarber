import React from "react";
import { Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  countryName: string;
  cityName: string;
  onChange: (next: { country: string; city: string }) => void;
  countryLabel?: string;
  cityLabel?: string;
  countryPlaceholder?: string;
  cityPlaceholder?: string;
  required?: boolean;
};

/**
 * Plain country/city inputs guided only by placeholder text. No catalog
 * fetching, no autocomplete suggestions, no country locking — whatever the
 * user types is what gets saved.
 */
export function CountryCityFields({
  countryName, cityName, onChange,
  countryLabel = "Pays", cityLabel = "Ville",
  countryPlaceholder = "Ex. RD Congo",
  cityPlaceholder = "Ex. Kinshasa",
  required,
}: Props) {
  const c = useColors();

  const inputStyle = {
    backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
    borderRadius: c.radius, padding: 14, fontFamily: "Inter_400Regular" as const, fontSize: 15,
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
          {countryLabel}{required ? " *" : ""}
        </Text>
        <TextInput
          value={countryName}
          onChangeText={(text) => onChange({ country: text, city: cityName })}
          autoCapitalize="words"
          placeholder={countryPlaceholder}
          placeholderTextColor={c.mutedForeground}
          style={inputStyle}
        />
      </View>

      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
          {cityLabel}{required ? " *" : ""}
        </Text>
        <TextInput
          value={cityName}
          onChangeText={(text) => onChange({ country: countryName, city: text })}
          autoCapitalize="words"
          placeholder={cityPlaceholder}
          placeholderTextColor={c.mutedForeground}
          style={inputStyle}
        />
      </View>
    </View>
  );
}
