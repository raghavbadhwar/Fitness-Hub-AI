import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/.vercel/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/.agents/**",
      "**/.claude/**",
      "**/.codex/**",
      "**/.local/**",
      "**/.playwright-cli/**",
      "**/static-build/**",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.test.{js,mjs,cjs,ts,tsx}", "tests/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
