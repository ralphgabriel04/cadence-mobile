/**
 * Smoke tests to verify the app can be set up properly.
 * These tests ensure basic modules can be imported without crashing.
 *
 * Static import on purpose: babel-preset-expo keeps dynamic `import()` for
 * Metro lazy loading, which Jest cannot run without --experimental-vm-modules.
 */

import { maskEmail } from "../utils/mask-email";

describe("Smoke Tests", () => {
  it("should import the mask-email utility without errors", () => {
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
