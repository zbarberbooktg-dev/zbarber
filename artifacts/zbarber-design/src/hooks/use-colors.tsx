import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { nativeTheme } from "../lib/native-theme";

const ThemeContext = createContext<"light" | "dark" | undefined>(undefined);

/** The product owns its saved preference; the system owns palette resolution. */
export function NativeThemeProvider({ mode, children }: React.PropsWithChildren<{ mode: "light" | "dark" }>) {
  return <ThemeContext.Provider value={mode}>{children}</ThemeContext.Provider>;
}

export function useColors(mode?: "light" | "dark") {
  const contextMode = useContext(ThemeContext);
  const systemMode = useColorScheme();
  const effective = mode ?? contextMode ?? systemMode ?? "dark";
  return { ...nativeTheme[effective], radius: nativeTheme.radius, isDark: effective === "dark" };
}
