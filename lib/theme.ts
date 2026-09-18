// Shared theme tokens — the real Photo-OP brand palette (pulled from
// next-web's tailwind.config.ts: primary #f95f2e, secondary #0c8ce9).
// Split dark/light surfaces only — no pure black, by design choice.

export const colors = {
  light: {
    background: "#EDF3FC",
    surface: "#FFFFFF",
    text: "#2D2D55",
    textMuted: "#737373",
    border: "#DCE3F0",
    accent: "#F95F2E",
    accentText: "#FFFFFF",
    secondary: "#0C8CE9",
    secondaryText: "#FFFFFF",
  },
  dark: {
    background: "#15161A",
    surface: "#1F2025",
    text: "#ECEDEE",
    textMuted: "#9A9CA5",
    border: "#2C2D33",
    accent: "#F95F2E",
    accentText: "#FFFFFF",
    secondary: "#0C8CE9",
    secondaryText: "#FFFFFF",
  },
} as const;

export type ThemeName = keyof typeof colors;
export type ThemeColors = (typeof colors)[ThemeName];

// react-native's useColorScheme() can return "unspecified" or null
// depending on platform; normalize to a theme we actually have tokens for.
export function resolveTheme(scheme: string | null | undefined): ThemeColors {
  return scheme === "dark" ? colors.dark : colors.light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
