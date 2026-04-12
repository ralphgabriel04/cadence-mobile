/**
 * Smoke tests to verify the app can be set up properly.
 * These tests ensure basic modules can be imported without crashing.
 */

describe("Smoke Tests", () => {
  it("should import the mask-email utility without errors", async () => {
    const { maskEmail } = await import("../utils/mask-email");
    expect(typeof maskEmail).toBe("function");
  });

  it("should have Jest configured correctly", () => {
    expect(true).toBe(true);
  });

  it("should support async/await", async () => {
    const result = await Promise.resolve("cadence");
    expect(result).toBe("cadence");
  });

  it("should have access to Node.js globals", () => {
    expect(typeof process).toBe("object");
    expect(typeof __dirname).toBe("string");
  });
});

describe("Environment", () => {
  it("should be running in test environment", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });
});
