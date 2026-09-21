import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga docs/21 §2.2 — rute lambang adalah pintu KETIGA tanpa login, dan ia
 * harus tetap sesempit itu.
 *
 * Dua pintu tanpa login yang sudah ada (docs/06 §4.3) masing-masing membawa
 * aturannya sendiri: katalog hanya melayani salinan beku berstatus TERBIT,
 * pratinjau bertoken hanya melayani token yang sah. Satu pemanggilan silang
 * saja cukup untuk membuat aturan pintu yang satu diam-diam berlaku bagi yang
 * lain — dan tidak ada galat yang muncul, hanya draf yang bocor ke katalog.
 *
 * Rute lambang tidak boleh menjadi jalan pintas ke salah satunya. Yang boleh
 * keluar dari sana hanyalah bita gambar lembaga: tidak ada isi dokumen, tidak
 * ada kelas, nilai, maupun evaluasi. Penjaganya tekstual, sebangun dengan
 * `src/lib/berbagi/pintu.test.ts`.
 */

const PEMUAT = readFileSync("src/lib/prodi/logo.ts", "utf8");
const RUTE_PRODI = readFileSync("src/app/api/prodi/[id]/logo/route.ts", "utf8");
const RUTE_INSTITUSI = readFileSync("src/app/api/institusi/logo/route.ts", "utf8");
const PUBLIK = readFileSync("src/lib/publik/muat.ts", "utf8");
const BERBAGI = readFileSync("src/lib/berbagi/muat.ts", "utf8");

/** Kode tanpa komentar — lihat catatan yang sama di `berbagi/pintu.test.ts`. */
function kodeSaja(berkas: string): string {
  return berkas
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((b) => !b.trimStart().startsWith("//"))
    .join("\n");
}

const PEMUAT_KODE = kodeSaja(PEMUAT);
const RUTE = kodeSaja(RUTE_PRODI) + "\n" + kodeSaja(RUTE_INSTITUSI);

describe("pintu lambang lembaga", () => {
  it("tidak memanggil pemuat katalog maupun pemuat tautan bertoken", () => {
    for (const [nama, kode] of [
      ["pemuat lambang", PEMUAT_KODE],
      ["rute lambang", RUTE],
    ] as const) {
      assert.ok(!kode.includes("@/lib/publik/muat"), `${nama} memanggil pemuat katalog`);
      assert.ok(!kode.includes("@/lib/berbagi"), `${nama} memanggil pemuat bertoken`);
    }
  });

  it("tidak dipanggil balik oleh kedua pintu yang sudah ada", () => {
    assert.ok(!PUBLIK.includes("@/lib/prodi/logo"), "publik/muat.ts memanggil pemuat lambang");
    assert.ok(!BERBAGI.includes("@/lib/prodi/logo"), "berbagi/muat.ts memanggil pemuat lambang");
  });

  /**
   * Nilai mahasiswa tidak punya jalur tanpa login, dan pagar itu tidak dapat
   * diberikan tipe: yang menjaganya adalah tidak adanya kodenya.
   */
  it("tidak menyentuh kelas, nilai, peserta, maupun evaluasi", () => {
    for (const terlarang of ["kelas", "nilai", "evaluasi", "peserta", "rpkps"]) {
      assert.ok(
        !new RegExp(`\\b${terlarang}\\b`, "i").test(PEMUAT_KODE + RUTE),
        `pintu lambang menyebut ${terlarang}`,
      );
    }
  });

  /**
   * Hanya dua tabel yang boleh dibacanya, dan hanya kolom lambangnya. Sebuah
   * `select` yang melebar diam-diam adalah cara termudah membuat pintu ini
   * melayani lebih dari yang dijanjikannya.
   */
  it("hanya membaca kolom lambang dari prodi dan institusi", () => {
    const tabel = [...PEMUAT_KODE.matchAll(/prisma\.(\w+)\./g)].map((m) => m[1]);
    assert.deepEqual([...new Set(tabel)].sort(), ["institusi", "prodi"]);

    const kolom = [...PEMUAT_KODE.matchAll(/select: \{([^}]*)\}/g)].flatMap((m) =>
      m[1]!.split(",").map((k) => k.split(":")[0]!.trim()).filter(Boolean),
    );
    assert.deepEqual([...new Set(kolom)].sort(), ["diubahPada", "logo", "logoTipe"]);
  });

  /**
   * Berkas yang disajikan dari asal-usul kita sendiri dieksekusi di dalam
   * asal-usul kita bila peramban salah menebak jenisnya. Alasan yang sama
   * membuat rute gambar bab tidak pernah menyajikan SVG (docs/17 §5.2).
   */
  it("menolak penebakan jenis oleh peramban", () => {
    assert.match(PEMUAT, /"X-Content-Type-Options": "nosniff"/);
  });

  /** SVG tidak pernah tersimpan, jadi ia tidak boleh pernah tersaji. */
  it("tidak menyebut SVG sama sekali", () => {
    assert.ok(!/svg/i.test(PEMUAT_KODE + RUTE), "pintu lambang menyebut SVG");
  });
});
