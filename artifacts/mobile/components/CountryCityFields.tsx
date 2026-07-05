import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { AFRICAN_COUNTRIES } from "@/constants/africanCountries";

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
 * Country is a fixed dropdown restricted to African countries (selected via
 * a modal list) — no free text. City stays a plain text input.
 */
export function CountryCityFields({
  countryName, cityName, onChange,
  countryLabel = "Pays", cityLabel = "Ville",
  countryPlaceholder = "Sélectionner un pays",
  cityPlaceholder = "Ex. Lomé",
  required,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);

  const inputStyle = {
    backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
    borderRadius: c.radius, padding: 14, fontFamily: "Inter_400Regular" as const, fontSize: 15,
  };

  const selected = useMemo(
    () => AFRICAN_COUNTRIES.find((cty) => cty.name === countryName),
    [countryName],
  );

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
          {countryLabel}{required ? " *" : ""}
        </Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[inputStyle, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
        >
          <Text
            style={{
              color: countryName ? c.foreground : c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
            }}
          >
            {countryName || countryPlaceholder}
          </Text>
          <Feather name="chevron-down" size={16} color={c.mutedForeground} />
        </Pressable>
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

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
          <View
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border,
            }}
          >
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {countryLabel}
            </Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
              <Feather name="x" size={22} color={c.foreground} />
            </Pressable>
          </View>
          <FlatList
            data={AFRICAN_COUNTRIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const active = item.code === selected?.code;
              return (
                <Pressable
                  onPress={() => {
                    onChange({ country: item.name, city: cityName });
                    setPickerOpen(false);
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingHorizontal: 20, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: c.border,
                    backgroundColor: active ? c.muted : "transparent",
                  }}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                    {item.name}
                  </Text>
                  {active && <Feather name="check" size={16} color={c.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
