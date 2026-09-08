import { Text as RNText, type TextProps as RNTextProps } from "react-native";

type Variant = "heading" | "body" | "caption" | "error";
export type Weight = "regular" | "medium" | "semibold" | "bold";

type TextProps = RNTextProps & {
  variant?: Variant;
  /** Font weight. Defaults to bold for `heading`, regular otherwise. */
  weight?: Weight;
  /** DM Mono, for numbers and data. */
  mono?: boolean;
};

// Each weight is its own expo-font family (see tailwind.config.js), so the
// family class carries the weight. Never add `font-bold` on top of these.
const SANS: Record<Weight, string> = {
  regular: "font-sans",
  medium: "font-sans-medium",
  semibold: "font-sans-semibold",
  bold: "font-sans-bold",
};

const MONO: Record<Weight, string> = {
  regular: "font-mono",
  medium: "font-mono-medium",
  semibold: "font-mono-medium",
  bold: "font-mono-medium",
};

const variantStyles: Record<Variant, string> = {
  heading: "text-[22px] leading-7 tracking-[-0.5px] text-text",
  body: "text-sm text-text",
  caption: "text-xs text-text-sub",
  error: "text-xs text-error",
};

export function Text({
  variant = "body",
  weight,
  mono = false,
  className = "",
  ...props
}: TextProps) {
  const w: Weight = weight ?? (variant === "heading" ? "bold" : "regular");
  // eslint-disable-next-line security/detect-object-injection -- typed enums, not user input
  const family = mono ? MONO[w] : SANS[w];

  return (
    // eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input
    <RNText className={`${family} ${variantStyles[variant]} ${className}`} {...props} />
  );
}
