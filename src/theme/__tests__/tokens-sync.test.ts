import { readFileSync } from "fs";

import { palette } from "../tokens";

/**
 * tokens.ts mirrors global.css by hand (NativeWind can't read CSS vars from
 * JS). This test names every palette colour that drifted from its CSS var.
 * Only tokens.ts -> global.css is checked: the CSS may hold extra vars the JS
 * doesn't need (--pill-bg, --warning...).
 */

const css: string = readFileSync(`${__dirname}/../../../global.css`, "utf8");

function parseVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    if (name && value) vars[name] = normalizeHex(value);
  }
  return vars;
}

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** textSub -> text-sub, accentDim -> accent-dim, surface2 -> surface2 */
function toCssVar(token: string): string {
  return token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// Light is the top-level :root; dark overrides it under prefers-color-scheme.
const lightBlock = /^:root\s*\{([^}]*)\}/m.exec(css)?.[1];
const darkBlock = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(
  css
)?.[1];

if (!lightBlock || !darkBlock) {
  throw new Error("Could not find the light and dark :root blocks in global.css");
}

const lightVars = parseVars(lightBlock);
// Dark inherits every var it doesn't redefine (e.g. --success, --error).
const darkVars = { ...lightVars, ...parseVars(darkBlock) };

const cases = [
  ...Object.entries(palette.light).map(([token, hex]) => ["light", token, hex, lightVars] as const),
  ...Object.entries(palette.dark).map(([token, hex]) => ["dark", token, hex, darkVars] as const),
];

describe("tokens.ts matches global.css", () => {
  it.each(cases)("%s › %s", (_mode, token, hex, vars) => {
    const cssVar = toCssVar(token);
    const cssHex = vars[cssVar];
    if (cssHex === undefined) {
      throw new Error(`--${cssVar} is missing from global.css`);
    }
    if (cssHex !== normalizeHex(hex)) {
      throw new Error(`tokens.ts ${hex} ≠ global.css --${cssVar} ${cssHex}`);
    }
  });
});
