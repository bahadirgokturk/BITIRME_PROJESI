import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Kural kunyesi: KOD_KURALLARI.md (fail fast, az dallanma, olu kod)
const codeRules = {
  "no-empty": "error",
  complexity: ["error", 8],
  "max-depth": ["error", 3],
  // Early return: return sonrasinda else yazilmaz (kural 2)
  "no-else-return": ["error", { allowElseIf: false }],
  // En fazla 4 parametre; fazlasi tek bir nesne olarak verilir (kural 2)
  "max-params": ["error", 4],
  // Fonksiyon ~40 satiri, dosya 300 satiri gecmez (kural 2); bos satir ve yorum sayilmaz
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: codeRules },
  // Testlerde describe/it bloklari uzun olabilir; uretilmis API tipleri elle yazilmaz
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "max-lines-per-function": "off", "max-lines": "off" },
  },
  { files: ["src/lib/api/types.ts"], rules: { "max-lines": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
