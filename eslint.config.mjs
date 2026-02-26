import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  // Next.js recommended rules
  ...compat.extends("next/core-web-vitals"),

  // TypeScript strict rules
  ...tseslint.configs.strict,

  // Prettier compatibility (disables conflicting rules)
  ...compat.extends("prettier"),

  // Global ignores
  {
    ignores: [
      ".next/",
      "node_modules/",
      "scripts/",
      "supabase/",
      "*.sql",
      "*.js",
      "*.mjs",
    ],
  },

  // Project-specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Warn on any (will tighten to error later)
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Allow empty interfaces (common in React)
      "@typescript-eslint/no-empty-object-type": "off",

      // Allow non-null assertions (common with Supabase)
      "@typescript-eslint/no-non-null-assertion": "off",

      // Console is OK in this app (no production logging infra)
      "no-console": "off",
    },
  }
);
