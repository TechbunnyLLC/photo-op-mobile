// Shared theme tokens. Split dark/light surfaces only — no pure black.
// Swap these for the real Photo-OP brand palette once it exists.

export const colors = {
  light: {
    background: "#F7F7F8",
    surface: "#FFFFFF",
    text: "#16171B",
    textMuted: "#6B6E76",
    border: "#E4E4E8",
    accent: "#FF5A36",
    accentText: "#FFFFFF",
  },
  dark: {
    background: "#15161A",
    surface: "#1F2025",
    text: "#F2F2F4",
    textMuted: "#9A9CA5",
    border: "#2C2D33",
    accent: "#FF7A54",
    accentText: "#15161A",
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
