import { useColorScheme } from "nativewind";

/**
 * Hex mirror of the CSS variables in global.css, for the handful of props that
 * take a raw colour instead of a className: tab bar options, ActivityIndicator,
 * RefreshControl, placeholderTextColor, icon colours.
 *
 * Duplicated on purpose: NativeWind has no API to read a resolved var() from
 * JS. Keep both files in sync when a token changes.
 */
export const palette = {
  light: {
    bg: "#f6f6f8",
    surface: "#ffffff",
    surface2: "#f0f0f4",
    border: "#e4e4ec",
    text: "#111118",
    textSub: "#707088",
    textMuted: "#a0a0b4",
    accent: "#d63a24",
    accentDim: "#fbe4df",
    btnPrimaryText: "#ffffff",
    success: "#34d399",
    error: "#ef4444",
  },
  dark: {
    bg: "#0c0c0f",
    surface: "#16161c",
    surface2: "#1e1e28",
    border: "#2a2a36",
    text: "#eeeef5",
    textSub: "#9090a8",
    textMuted: "#50506a",
    accent: "#f0533f",
    accentDim: "#2b1512",
    btnPrimaryText: "#0c0c0f",
    success: "#34d399",
    error: "#ef4444",
  },
} as const;

export type Palette = Record<keyof (typeof palette)["light"], string>;

export function usePalette(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? palette.dark : palette.light;
}

/** Font family names as registered by useFonts() in app/_layout.tsx. */
export const fonts = {
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansSemibold: "DMSans_600SemiBold",
  sansBold: "DMSans_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;
