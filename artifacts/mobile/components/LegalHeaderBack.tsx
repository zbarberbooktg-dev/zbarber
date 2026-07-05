import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable } from "react-native";

import { useColors } from "@/hooks/useColors";

// Legal screens (Terms/Privacy) are reachable from several places (sign-up,
// client profile, barber profile) that live in different navigators (a plain
// Stack for auth, Tabs for client/barber). The default header back arrow
// relies on `navigation.goBack()`, which can be a no-op if there is no
// history to pop back to (e.g. deep link, or a navigator edge case). This
// explicit handler guarantees the button always does something sensible:
// pop if possible, otherwise send the user to a safe default screen.
export function LegalHeaderBack() {
  const c = useColors();
  const router = useRouter();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={12} style={{ paddingRight: 12, paddingVertical: 4 }}>
      <Feather name="chevron-left" size={26} color={c.primary} />
    </Pressable>
  );
}
