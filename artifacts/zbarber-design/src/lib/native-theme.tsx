import { tokens } from "../generated/tokens";

const palette = (mode: "light" | "dark") => {
  const color = tokens.color[mode];
  return {
    ...color,
    text: color.foreground,
    tint: color.primary,
    sidebarBg: color.sidebar,
    success: color.chart2,
    warning: color.primary,
  };
};

export const nativeTheme = {
  light: palette("light"),
  dark: palette("dark"),
  radius: Number.parseFloat(tokens.radius) * (tokens.radius.endsWith("rem") ? 16 : 1),
};

export const nativeFonts = {
  display: "PlayfairDisplay_500Medium",
  title: "PlayfairDisplay_500Medium",
  subtitle: "Inter_600SemiBold",
  body: "Inter_400Regular",
  label: "Inter_600SemiBold",
  caption: "Inter_400Regular",
} as const;

export type NativeColors = (typeof nativeTheme)["light"] | (typeof nativeTheme)["dark"];
