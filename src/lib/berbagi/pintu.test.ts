import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga amandemen docs/06 §4.3 — DUA pintu tanpa login, dan keduanya
 * tertutup rapat pada berkasnya masing-masing.
 *
 *   `src/lib/publik/muat.ts`   → katalog: hanya TERBIT, hanya salinan beku,
 *                                terindeks.
 *   `src/lib/berbagi/muat.ts`  → pratinjau: hanya lewat token yang sah dan
 *                                belum kedaluwarsa, data langsung, selalu
 *                                bertanda draf, tidak pernah terindeks.
 *
 * Satu pemanggilan silang saja cukup untuk membuat aturan pintu yang satu
 * diam-diam berlaku bagi yang lain — dan itu tidak menghasilkan galat apa pun,
 * hanya draf yang bocor ke katalog atau dokumen terbit yang dilayani tanpa
 * salinan beku. Karena itu penjaganya tekstual.
 */

const PUBLIK = readFileSync("src/lib/publik/muat.ts", "utf8");
const BERBAGI = readFileSync("src/lib/berbagi/muat.ts", "utf8");
const HALAMAN = readFileSync(
  "src/app/[bahasa]/(publik)/pratinjau/[token]/page.tsx",
  "utf8",
);
const ROBOTS = readFileSync("src/app/robots.ts", "utf8");
const PRATINJAU_APLIKASI = readFileSync(
  "src/app/[bahasa]/(app)/rpkps/[id]/pratinjau/page.tsx",
  "utf8",
);

/**
 * Kode tanpa komentar.
 *
 * Penjaga yang mencari kata terlarang harus melihat kode saja: komentar yang
 * MENJELASKAN mengapa sesuatu tidak boleh ada akan terhitung sebagai
 * keberadaannya, dan penjaganya berubah menjadi larangan menulis penjelasan.
 * Pola yang sama dipakai `src/lib/ai/terjemahan-rpkps.test.ts`.
 */
function kodeSaja(berkas: string): string {
  return berkas
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((b) => !b.trimStart().startsWith("//"))
    .join("\n");
}

const HALAMAN_KODE = kodeSaja(HALAMAN);
const PRATINJAU_APLIKASI_KODE = kodeSaja(PRATINJAU_APLIKASI);

describe("dua pintu tanpa login", () => {
  it("pemuat katalog tidak mengenal tautan pratinjau", () => {
    assert.ok(!PUBLIK.includes("@/lib/berbagi"), "publik/muat.ts memanggil berbagi");
    assert.ok(!/tautanBerbagi/.test(PUBLIK), "publik/muat.ts menyentuh tabel tautan");
  });

  it("pemuat pratinjau tidak mengenal katalog", () => {
    assert.ok(!BERBAGI.includes("@/lib/publik/muat"), "berbagi/muat.ts memanggil katalog");
  });

  it("pratinjau menolak token yang dicabut atau kedaluwarsa lewat domain", () => {
    // Aturannya murni dan teruji di `domain/rpkps/berbagi.test.ts`; yang
    // dijaga di sini adalah bahwa pemuatnya benar-benar memakainya.
    assert.match(BERBAGI, /bolehDibuka\(/);
  });

  it("pratinjau tidak pernah mencetak sidik dokumen", () => {
    // Sidik hanya milik salinan beku. Mencetaknya di halaman draf membuat
    // dokumen yang belum disahkan tampak seresmi yang sudah (docs/06 §4.2).
    assert.ok(!/sidik/i.test(HALAMAN_KODE), "halaman pratinjau menyebut sidik");
  });

  it("pratinjau tidak pernah terindeks — dua lapis", () => {
    assert.match(HALAMAN, /robots: \{ index: false, follow: false/);
    assert.match(ROBOTS, /"\/pratinjau"/);
  });

  /**
   * Pratinjau DI DALAM aplikasi memakai komponen tampilan yang sama dengan
   * katalog publik, dan justru karena itu ia mudah tergelincir menjadi pintu
   * ketiga: sekali ia memanggil salah satu pemuat tanpa login, aturan pintu
   * itu ikut terbawa ke halaman yang seharusnya dijaga sesi.
   */
  it("pratinjau dalam aplikasi bukan pintu ketiga", () => {
    assert.ok(
      !PRATINJAU_APLIKASI_KODE.includes("@/lib/publik/muat"),
      "pratinjau aplikasi memanggil pemuat katalog",
    );
    assert.ok(
      !PRATINJAU_APLIKASI_KODE.includes("@/lib/berbagi/muat"),
      "pratinjau aplikasi memanggil pemuat tautan bertoken",
    );
    // Gerbangnya sesi dan wewenang, sama seperti halaman ikhtisar.
    assert.match(PRATINJAU_APLIKASI_KODE, /wajibAktif\(\)/);
    assert.match(PRATINJAU_APLIKASI_KODE, /wenangAtasRpkps\(sesi, rpkps\)\.bolehLihat/);
  });

  it("halaman pratinjau tidak menyentuh kelas, nilai, maupun evaluasi", () => {
    // Nilai mahasiswa tidak boleh punya jalur tanpa login, dan pagar itu tidak
    // dapat diberikan tipe: yang menjaganya adalah tidak adanya kodenya.
    for (const terlarang of ["kelas", "nilai", "evaluasi", "peserta"]) {
      assert.ok(
        !new RegExp(`\\b${terlarang}\\b`, "i").test(HALAMAN_KODE),
        `halaman pratinjau menyebut ${terlarang}`,
      );
    }
  });
});
