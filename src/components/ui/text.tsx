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

// Size and colour are split so a size passed by the caller replaces the
// variant's size instead of competing with it: on the web, `text-sm` won over
// `text-[13px]` whatever the order, so arbitrary sizes were silently ignored.
const variantSize: Record<Variant, string> = {
  heading: "text-[22px] leading-7 tracking-[-0.5px]",
  body: "text-sm",
  caption: "text-xs",
  error: "text-xs",
};

const variantColour: Record<Variant, string> = {
  heading: "text-text",
  body: "text-text",
  caption: "text-text-sub",
  error: "text-error",
};

/** A font-size class (`text-xs` to `text-9xl`, or `text-[13px]`), not a colour like `text-text-sub`. */
const isSizeClass = (c: string) => /^text-(xs|sm|base|lg|[2-9]?xl)$/.test(c) || /^text-\[[\d.]+px\]$/.test(c);

const ALIGN = new Set(["text-left", "text-center", "text-right", "text-justify"]);

/** A colour class (`text-accent`, `text-text-sub`...): any `text-*` that is neither a size nor an alignment. */
const isColourClass = (c: string) => c.startsWith("text-") && !isSizeClass(c) && !ALIGN.has(c);

/** True when `className` sets a text colour (callers can then skip their default one). */
export function hasColourClass(className: string): boolean {
  return className.split(/\s+/).some(isColourClass);
}

/**
 * The variant's classes, minus its size when `className` sets one and minus
 * its colour when `className` sets one: on the web two classes of the same
 * kind do not resolve by order, so the caller's could lose.
 */
export function variantClasses(variant: Variant, className: string): string {
  const classes = className.split(/\s+/);
  // eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input
  const size = classes.some(isSizeClass) ? "" : variantSize[variant];
  // eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input
  const colour = classes.some(isColourClass) ? "" : variantColour[variant];
  return [size, colour].filter(Boolean).join(" ");
}

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
    <RNText className={`${family} ${variantClasses(variant, className)} ${className}`} {...props} />
  );
}
