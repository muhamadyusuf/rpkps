import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Klien Prisma yang dihasilkan otomatis — bukan kode yang kita tulis.
    "src/generated/**",
  ]),
  {
    rules: {
      /**
       * Awalan garis bawah menandai nilai yang sengaja tidak dipakai. Pola ini
       * dibutuhkan saat sebuah field dibuang lewat destructuring — mis.
       * `const { kisiKisi: _kisiKisi, ...sisa }` di domain/rpkps/publik.ts,
       * yang justru bermaksud MEMBUANG field itu.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
