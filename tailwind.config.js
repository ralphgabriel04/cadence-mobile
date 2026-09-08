/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Values live in global.css (:root light + @media dark); NativeWind
      // resolves var() at runtime against the current color scheme.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-sub": "var(--text-sub)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        "pill-bg": "var(--pill-bg)",
        "pill-text": "var(--pill-text)",
        "btn-primary-bg": "var(--btn-primary-bg)",
        "btn-primary-text": "var(--btn-primary-text)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
      },
      borderRadius: {
        input: "12px",
        card: "16px",
        pill: "40px",
      },
      // One family per weight: an expo-font face is registered under its own
      // name, so `font-bold` on a single-face family would not select it.
      fontFamily: {
        sans: ["DMSans_400Regular"],
        "sans-medium": ["DMSans_500Medium"],
        "sans-semibold": ["DMSans_600SemiBold"],
        "sans-bold": ["DMSans_700Bold"],
        mono: ["DMMono_400Regular"],
        "mono-medium": ["DMMono_500Medium"],
      },
    },
  },
  plugins: [],
};
