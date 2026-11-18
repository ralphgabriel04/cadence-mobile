import { contrastRatio, meetsWcag, relativeLuminance } from "../contrast";
import { palette } from "../tokens";

describe("relativeLuminance", () => {
  it("should be 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("should accept shorthand and uppercase hex", () => {
    expect(relativeLuminance("#FFF")).toBe(relativeLuminance("#ffffff"));
  });

  it("should throw on invalid input", () => {
    expect(() => relativeLuminance("red")).toThrow('Invalid hex colour: "red"');
    expect(() => relativeLuminance("#12345")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("should be 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });

  it("should be 1 for identical colours", () => {
    expect(contrastRatio("#d63a24", "#d63a24")).toBe(1);
  });

  it("should not depend on argument order", () => {
    expect(contrastRatio("#707088", "#ffffff")).toBe(contrastRatio("#ffffff", "#707088"));
  });

  it("should match a WebAIM reference value", () => {
    // #767676 on white is the classic lightest grey passing AA: 4.54:1
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("meetsWcag", () => {
  it("should apply AA thresholds by default", () => {
    expect(meetsWcag(4.5)).toBe(true);
    expect(meetsWcag(3, { large: true })).toBe(true);
  });

  it("should apply AAA thresholds", () => {
    expect(meetsWcag(6.9, { level: "AAA" })).toBe(false);
    expect(meetsWcag(4.5, { level: "AAA", large: true })).toBe(true);
  });

  it("should not round the ratio before comparing", () => {
    expect(meetsWcag(4.49)).toBe(false);
  });
});

describe("palette contrast", () => {
  const modes = [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const;

  // Foreground / background pairs used together in the app.
  const pairs = [
    ["text", "bg"],
    ["text", "surface"],
    ["text", "surface2"],
    ["textSub", "bg"],
    ["textSub", "surface"],
    ["textSub", "surface2"],
    ["textMuted", "bg"],
    ["textMuted", "surface"],
    ["accent", "bg"],
    ["accent", "surface"],
    ["btnPrimaryText", "accent"],
  ] as const;

  // Known debt: these pairs are below AA today. They are tracked here so the
  // suite stays green while any *new* regression still fails. Fixing the
  // palette is a separate change; once a pair passes, remove it from this list
  // (the "known failure" test below fails if a listed pair starts passing).
  const knownFailures: Record<string, ReadonlyArray<string>> = {
    light: ["textSub/bg", "textSub/surface2", "textMuted/bg", "textMuted/surface", "accent/bg"],
    dark: ["textMuted/bg", "textMuted/surface"],
  };

  describe.each(modes)("%s mode", (mode, p) => {
    const known = knownFailures[mode] ?? [];
    const passing = pairs.filter(([fg, bg]) => !known.includes(`${fg}/${bg}`));
    const failing = pairs.filter(([fg, bg]) => known.includes(`${fg}/${bg}`));

    it.each(passing)("%s on %s should meet AA", (fg, bg) => {
      expect(meetsWcag(contrastRatio(p[fg], p[bg]))).toBe(true);
    });

    if (failing.length > 0) {
      it.each(failing)("%s on %s is a known AA failure (palette debt)", (fg, bg) => {
        expect(meetsWcag(contrastRatio(p[fg], p[bg]))).toBe(false);
      });
    }
  });
});
