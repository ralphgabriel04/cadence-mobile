/**
 * WCAG 2.2 contrast ratio between two colours (success criteria 1.4.3,
 * 1.4.6 and 1.4.11).
 *
 * Why this lives in src/theme/ but not in tokens.ts:
 * - It belongs with the theme: its main job is checking that the palette
 *   stays readable, so it sits next to the tokens it audits.
 * - It stays out of tokens.ts because that file is pure design data mirrored
 *   from global.css. Mixing logic into it would blur that role.
 * - tokens.ts imports nativewind; keeping this file dependency-free lets it
 *   be unit-tested (and reused on any colour, not just palette ones) without
 *   loading React Native.
 *
 * @example contrastRatio("#000000", "#ffffff") // 21
 * @example contrastRatio("#fff", "#fff")        // 1
 */

export type WcagLevel = "AA" | "AAA";

/** Minimum ratios. "large" covers large text (>= 24px, or >= 18.66px bold) and UI components. */
const THRESHOLDS: Record<WcagLevel, { normal: number; large: number }> = {
  AA: { normal: 4.5, large: 3 },
  AAA: { normal: 7, large: 4.5 },
};

function parseHex(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Invalid hex colour: "${hex}"`);
  }

  let digits = match[1] ?? "";
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((d) => d + d)
      .join("");
  }

  const channel = (i: number) => parseInt(digits.substring(i, i + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Contrast ratio from 1 to 21. Argument order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Whether a ratio passes the given level. The ratio is compared unrounded,
 * as WCAG requires: 4.49 fails AA even though it displays as "4.5".
 */
export function meetsWcag(
  ratio: number,
  { level = "AA", large = false }: { level?: WcagLevel; large?: boolean } = {}
): boolean {
  const threshold = level === "AAA" ? THRESHOLDS.AAA : THRESHOLDS.AA;
  return ratio >= (large ? threshold.large : threshold.normal);
}
