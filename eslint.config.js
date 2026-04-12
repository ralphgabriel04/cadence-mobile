// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const securityPlugin = require("eslint-plugin-security");

module.exports = defineConfig([
  expoConfig,
  {
    plugins: {
      security: securityPlugin,
    },
    rules: {
      // TypeScript strict rules - zero tolerance for `any`
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Console usage - warn except for error/warn
      "no-console": ["warn", { allow: ["error", "warn"] }],

      // Best practices
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],

      // Security rules - Critical (blocking)
      "security/detect-eval-with-expression": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",

      // Security rules - Warning (monitoring)
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-require": "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".expo/",
      "web-build/",
      "android/",
      "ios/",
      "coverage/",
      "*.config.js",
      "babel.config.js",
      "metro.config.js",
    ],
  },
]);
