import { passwordStrength } from "../password-strength";

describe("passwordStrength", () => {
  it("under 8 characters is 'Trop court' and says the minimum", () => {
    expect(passwordStrength("")).toMatchObject({ level: 0, label: "Trop court" });
    expect(passwordStrength("Ab1!xyz")).toMatchObject({
      level: 0,
      hint: "Au moins 8 caractères",
    });
  });

  it.each([
    ["motdepasse99", "common French word"],
    ["Cadence2026", "app name"],
    ["Azerty123!", "keyboard run"],
    ["aaaaaaaaaaaa", "repeat"],
    ["abababababab", "short pattern repeated"],
    ["abcdefghij", "sequence"],
    ["MotDePasse!2026", "common word with accents removed and capitals"],
  ])("%s is capped at 'Faible' (%s)", (pw) => {
    expect(passwordStrength(pw)).toMatchObject({ level: 1, label: "Faible" });
  });

  it("grows with length and with kinds of characters", () => {
    expect(passwordStrength("bleuvertrouge").level).toBe(2); // 13 lower case
    expect(passwordStrength("Bleu7vertx").level).toBe(2); // 10, three kinds
    expect(passwordStrength("Bleu7vert-rouge").level).toBe(4); // 15, four kinds
    expect(passwordStrength("bleu vert rouge jaune").level).toBe(3); // 21, two kinds (space)
  });

  it("gives one concrete tip until 'Très fort', none after", () => {
    expect(passwordStrength("bleuvert").hint).toBe("Allonge-le à 12 caractères ou plus");
    expect(passwordStrength("bleuvertrouge").hint).toBe("Mélange majuscules, chiffres et symboles");
    expect(passwordStrength("Bleu7vert-rouge")).toMatchObject({ label: "Très fort", hint: null });
  });

  it("never returns a level outside 0 to 4", () => {
    for (const pw of ["", "x", "Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!", "é".repeat(30)]) {
      const { level } = passwordStrength(pw);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(4);
    }
  });
});
