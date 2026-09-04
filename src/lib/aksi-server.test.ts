import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Penjaga bentuk berkas `"use server"`.
 *
 * Next hanya mengizinkan berkas beranotasi `"use server"` mengekspor FUNGSI
 * ASYNC. Sebuah `export const` atau `export { KONSTANTA }` di dalamnya tetap
 * lolos `tsc`, lolos ESLint, dan lolos `next build` — lalu meledak saat modul
 * itu dievaluasi:
 *
 *   Error: A "use server" file can only export async functions, found number.
 *
 * Gejalanya muncul di halaman yang memakainya, bukan di berkasnya, dan hanya
 * ketika halaman itu benar-benar dibuka. Karena itu penjaganya tekstual.
 */

function berkasTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return berkasTs(jalur);
    return /\.tsx?$/.test(nama) && !nama.endsWith(".test.ts") ? [jalur] : [];
  });
}

/** Ekspor yang memang diperbolehkan: fungsi async, dan apa pun yang bertipe. */
const BOLEH = [
  /^export async function /,
  /^export type /,
  /^export interface /,
  /^export type \{/,
];

describe('berkas "use server"', () => {
  const berkas = berkasTs("src/app").filter((j) =>
    /^\s*["']use server["']/.test(readFileSync(j, "utf8")),
  );

  it("ada dan ditemukan — daftar yang kosong bukan penjaga", () => {
    assert.ok(berkas.length > 5, `hanya ${berkas.length} berkas "use server" ditemukan`);
  });

  for (const jalur of berkas) {
    it(`${jalur.split("/").slice(-2).join("/")} hanya mengekspor fungsi async`, () => {
      const nakal = readFileSync(jalur, "utf8")
        .split("\n")
        .filter((baris) => baris.startsWith("export "))
        .filter((baris) => !BOLEH.some((pola) => pola.test(baris)));

      assert.deepEqual(
        nakal,
        [],
        `${jalur} mengekspor nilai bukan-fungsi dari berkas "use server"`,
      );
    });
  }
});
