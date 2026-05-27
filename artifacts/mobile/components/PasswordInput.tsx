import React, { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export function PasswordInput(props: Omit<TextInputProps, "secureTextEntry">) {
  const c = useColors();
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ position: "relative", justifyContent: "center" }}>
      <TextInput
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          {
            backgroundColor: c.card,
            color: c.foreground,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: c.radius,
            padding: 14,
            paddingRight: 48,
            marginBottom: 16,
            fontFamily: "Inter_400Regular",
          },
          props.style,
        ]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        style={{ position: "absolute", right: 12, top: 0, bottom: 16, justifyContent: "center", paddingHorizontal: 4 }}
        accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <Feather name={visible ? "eye-off" : "eye"} size={20} color={c.mutedForeground} />
      </Pressable>
    </View>
  );
}
