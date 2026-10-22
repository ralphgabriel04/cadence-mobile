// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const securityPlugin = require("eslint-plugin-security");

module.exports = defineConfig([
  expoConfig,
  {
    // TypeScript and React rules MUST stay scoped to TS/TSX.
    //
    // These were previously declared in an unscoped config object, so they
    // applied to every linted file. ESLint 9 flat config ignores the `--ext`
    // flag in the lint script, which means any .js or .mjs file added anywhere
    // in the repo entered scope and hit
    //
    //   A configuration object specifies rule "@typescript-eslint/no-explicit-any",
    //   but could not find plugin "@typescript-eslint".
    //
    // eslint-config-expo registers the @typescript-eslint and react plugins for
    // TS files only, which is correct -- it is the rule declaration that has to
    // be scoped to match.
    files: ["**/*.ts", "**/*.tsx"],
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
    },
  },
  {
    plugins: {
      security: securityPlugin,
    },
    rules: {
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
