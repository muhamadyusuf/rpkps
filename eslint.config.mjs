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

  /**
   * Dua pagar dwibahasa (docs/11-dwibahasa.md).
   *
   * Keduanya menjaga hal yang gagal SECARA SENYAP: alamat tanpa awalan bahasa
   * tetap dikompilasi, tetap dirender, dan hanya salah saat dijalankan —
   * `revalidatePath("/rpkps")` diam-diam tidak menyegarkan apa pun, dan
   * `<Link href="/rpkps">` diam-diam melempar pengguna berbahasa Inggris
   * kembali ke bahasa Indonesia. Tidak ada uji yang menangkap keduanya.
   */
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/tautan.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Pakai `Tautan` dari @/components/tautan — ia memasang awalan bahasa pada href.",
            },
            {
              name: "next/cache",
              importNames: ["revalidatePath"],
              message:
                "Pakai `segarkan` dari @/lib/bahasa/segarkan — ia menyegarkan kedua bahasa.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
