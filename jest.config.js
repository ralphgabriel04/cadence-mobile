/** @type {import('jest').Config} */
module.exports = {
  // jest-expo supplies the React Native transform (via babel.config.js, so
  // NativeWind's jsxImportSource applies) and the transformIgnorePatterns for
  // expo, @expo, @expo-google-fonts, react-native and friends.
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/index.ts",
    // Exclude React Native specific files for now
    "!src/app/**",
    "!src/components/**",
    "!src/screens/**",
    "!src/providers/**",
  ],
  coverageThreshold: {
    global: {
      // Start low for MVP (Sprint 2), increase progressively
      branches: 20,
      functions: 15,
      lines: 20,
      statements: 20,
    },
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  clearMocks: true,
  testTimeout: 10000,
};
