import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type SlotOption = { label: string; iso: string };

type Props = {
  slots: SlotOption[];
  value: string | null;
  onChange: (iso: string) => void;
  placeholder?: string;
  emptyLabel?: string;
};

// A dropdown-style picker: a single row showing the current selection (or a
// placeholder) with a small chevron indicator, tapping opens a bottom-sheet
// list of every available slot. Replaces the old horizontally-scrolling chip
// row so long slot lists stay readable on small screens.
export function SlotPicker({ slots, value, onChange, placeholder, emptyLabel }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = slots.find((s) => s.iso === value) ?? null;

  return (
    <>
      <Pressable
        onPress={() => slots.length > 0 && setOpen(true)}
        disabled={slots.length === 0}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: selected ? c.primary : c.border,
          backgroundColor: c.card,
          opacity: slots.length === 0 ? 0.6 : pressed ? 0.85 : 1,
          borderRadius: c.radius - 4,
        })}
      >
        <Text
          style={{
            color: selected ? c.foreground : c.mutedForeground,
            fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
            fontSize: 14,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {selected ? selected.label : (slots.length === 0 ? (emptyLabel ?? "Aucun créneau disponible") : (placeholder ?? "Choisir un créneau"))}
        </Text>
        <Feather name="chevron-down" size={18} color={c.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 24,
              maxHeight: "70%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {placeholder ?? "Choisir un créneau"}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={c.mutedForeground} />
              </Pressable>
            </View>
            <FlatList
              data={slots}
              keyExtractor={(s) => s.iso}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
              renderItem={({ item }) => {
                const active = item.iso === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.iso);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderRadius: c.radius - 6,
                      backgroundColor: active ? c.accent : pressed ? c.muted : "transparent",
                    })}
                  >
                    <Text
                      style={{
                        color: active ? c.primary : c.foreground,
                        fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                        fontSize: 14,
                      }}
                    >
                      {item.label}
                    </Text>
                    {active && <Feather name="check" size={16} color={c.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
