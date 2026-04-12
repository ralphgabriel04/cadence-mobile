import { maskEmail } from "../mask-email";

describe("maskEmail", () => {
  it("should mask a standard email address", () => {
    expect(maskEmail("christian8339@hotmail.com")).toBe("ch*********39@hotmail.com");
  });

  it("should handle short local parts (4 chars or fewer)", () => {
    expect(maskEmail("test@cadence.app")).toBe("t***@cadence.app");
    expect(maskEmail("jo@gmail.com")).toBe("j***@gmail.com");
  });

  it("should handle 5-character local parts", () => {
    expect(maskEmail("hello@cadence.app")).toBe("he*lo@cadence.app");
  });

  it("should return empty string for empty input", () => {
    expect(maskEmail("")).toBe("");
  });

  it("should return original string for invalid email without @", () => {
    expect(maskEmail("notanemail")).toBe("notanemail");
  });

  it("should handle email with @ at the beginning", () => {
    expect(maskEmail("@domain.com")).toBe("@domain.com");
  });

  it("should preserve the domain completely", () => {
    const masked = maskEmail("user@very-long-domain-name.example.com");
    expect(masked).toContain("@very-long-domain-name.example.com");
  });

  it("should handle various domain extensions", () => {
    expect(maskEmail("ralph@cadence.io")).toContain("@cadence.io");
    expect(maskEmail("coach@training.fitness")).toContain("@training.fitness");
  });
});
