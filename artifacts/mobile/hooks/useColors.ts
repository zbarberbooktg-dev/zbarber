import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export function useColors() {
  const systemScheme = useColorScheme();
  const { themePref } = useApp();
  const effective = themePref === "system" ? systemScheme : themePref;
  const palette = effective === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius, isDark: effective === "dark" };
}
