/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F5F3EF",
      "foreground": "#17191E",
      "border": "#DEDAD3",
      "card": "#FFFFFF",
      "cardForeground": "#17191E",
      "popover": "#FFFFFF",
      "popoverForeground": "#17191E",
      "primary": "#C9A76A",
      "primaryForeground": "#0C0D10",
      "secondary": "#ECE9E3",
      "secondaryForeground": "#17191E",
      "muted": "#ECE9E3",
      "mutedForeground": "#676A72",
      "accent": "#EEE3D0",
      "accentForeground": "#63491E",
      "destructive": "#B83D3D",
      "destructiveForeground": "#FFFFFF",
      "input": "#DEDAD3",
      "ring": "#816130",
      "chart1": "#816130",
      "chart2": "#4C7668",
      "chart3": "#58728B",
      "chart4": "#9B6459",
      "chart5": "#75628A",
      "sidebar": "#FFFFFF",
      "sidebarForeground": "#17191E",
      "sidebarBorder": "#DEDAD3",
      "sidebarPrimary": "#C9A76A",
      "sidebarPrimaryForeground": "#0C0D10",
      "sidebarAccent": "#EEE3D0",
      "sidebarAccentForeground": "#63491E",
      "sidebarRing": "#816130"
    },
    "dark": {
      "background": "#0C0D10",
      "foreground": "#F5F3EF",
      "border": "#2B2D33",
      "card": "#17191E",
      "cardForeground": "#F5F3EF",
      "popover": "#17191E",
      "popoverForeground": "#F5F3EF",
      "primary": "#C9A76A",
      "primaryForeground": "#0C0D10",
      "secondary": "#22242A",
      "secondaryForeground": "#F5F3EF",
      "muted": "#22242A",
      "mutedForeground": "#92959D",
      "accent": "#30291E",
      "accentForeground": "#C9A76A",
      "destructive": "#F08080",
      "destructiveForeground": "#0C0D10",
      "input": "#2B2D33",
      "ring": "#C9A76A",
      "chart1": "#C9A76A",
      "chart2": "#83B6A1",
      "chart3": "#8DA9C8",
      "chart4": "#D59A89",
      "chart5": "#B09AC2",
      "sidebar": "#17191E",
      "sidebarForeground": "#F5F3EF",
      "sidebarBorder": "#2B2D33",
      "sidebarPrimary": "#C9A76A",
      "sidebarPrimaryForeground": "#0C0D10",
      "sidebarAccent": "#30291E",
      "sidebarAccentForeground": "#C9A76A",
      "sidebarRing": "#C9A76A"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Playfair Display",
      "Georgia",
      "serif"
    ],
    "mono": [
      "Menlo",
      "monospace"
    ]
  },
  "radius": "1rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
