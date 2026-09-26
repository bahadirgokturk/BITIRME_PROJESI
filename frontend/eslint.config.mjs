import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Kural kunyesi: KOD_KURALLARI.md (fail fast, az dallanma, olu kod)
const codeRules = {
  "no-empty": "error",
  complexity: ["error", 8],
  "max-depth": ["error", 3],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: codeRules },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // MSW tarafindan uretilir (npx msw init)
    "public/mockServiceWorker.js",
  ]),
]);

export default eslintConfig;
