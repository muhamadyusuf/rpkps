import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { barisKontak, type KopLembaga } from "./kop";

const LENGKAP: KopLembaga = {
  institusi: "Institut Teknologi Tangerang Selatan",
  prodi: "Program Studi Teknologi Informasi (S1)",
  alamat: "Jl. Raya Puspiptek, Tangerang Selatan",
  telepon: "(021) 1234 5678",
  surel: "ti@itts.ac.id",
  situs: "https://ti.itts.ac.id",
  logoInstitusi: null,
  logoProdi: null,
};

const KOSONG: KopLembaga = {
  ...LENGKAP,
  alamat: null,
  telepon: null,
  surel: null,
  situs: null,
};

describe("baris kontak kop", () => {
  it("merangkai yang ada dengan pemisah titik tengah", () => {
    assert.equal(
      barisKontak(LENGKAP, "id"),
      "Jl. Raya Puspiptek, Tangerang Selatan · Telp. (021) 1234 5678 · ti@itts.ac.id · ti.itts.ac.id",
    );
  });

  it("memakai label telepon bahasa berkasnya", () => {
    assert.match(barisKontak(LENGKAP, "en")!, /Tel\. \(021\) 1234 5678/);
  });

  /**
   * Yang kosong DIHILANGKAN, bukan dicetak sebagai "-" (docs/21 §4). Kop
   * berisi "Telp. - · Email: -" mengatakan lebih sedikit daripada kop yang
   * diam, dan prodi yang belum mengisi kontaknya adalah keadaan normal.
   */
  it("menghilangkan yang kosong, bukan mencetak tanda hubung", () => {
    assert.equal(barisKontak(KOSONG, "id"), null);
    assert.equal(
      barisKontak({ ...KOSONG, surel: "ti@itts.ac.id" }, "id"),
      "ti@itts.ac.id",
    );
  });

  /** Situs tercetak tanpa skema: "https://" adalah derau di atas kertas. */
  it("melepas skema dari alamat situs", () => {
    assert.equal(barisKontak({ ...KOSONG, situs: "http://ti.itts.ac.id" }, "id"), "ti.itts.ac.id");
  });
});

/**
 * Penjaga docs/21 §2.5 — kop adalah KERTASNYA, bukan naskahnya.
 *
 * Proyeksi isi adalah dasar sidik SHA-256. Menambahkan satu medan identitas
 * prodi ke sana menggeser sidik SELURUH RPKPS yang sudah terbit dan
 * memunculkan peringatan pergeseran palsu pada dokumen yang tidak disentuh
 * siapa pun. `proyeksi.test.ts` sudah mengunci sidik sebuah dokumen contoh
 * sebagai nilai harfiah; yang dijaga di sini adalah medannya — supaya
 * kegagalannya menyebut sebabnya, bukan hanya angka yang berubah.
 */
describe("identitas prodi di luar ruang sidik", () => {
  const RUANG = [
    "src/domain/rpkps/proyeksi.ts",
    "src/domain/rpkps/proyeksi-en.ts",
  ].map((j) => [j, readFileSync(j, "utf8")] as const);

  const MEDAN = ["visi", "misi", "alamat", "telepon", "surel", "situs", "logo"];

  for (const [jalur, isi] of RUANG) {
    it(`${jalur} tidak menyebut satu pun medan identitas`, () => {
      for (const medan of MEDAN) {
        assert.ok(
          !new RegExp(`\\b${medan}\\b`, "i").test(isi),
          `${jalur} menyebut ${medan} — sidik seluruh dokumen terbit akan bergeser`,
        );
      }
    });
  }

  it("salinan beku tidak membekukan kop", () => {
    const snapshot = readFileSync("src/lib/rpkps/snapshot.ts", "utf8");
    assert.ok(!snapshot.includes("kop"), "snapshot.ts membekukan kop");
    assert.ok(
      !snapshot.includes("@/lib/dokumen/muat-kop"),
      "snapshot.ts memuat kop",
    );
  });

  /**
   * Dan sebaliknya: perakit naskah HARUS memuatnya dari data langsung, bukan
   * mengambilnya dari salinan beku. Kalau ia pernah pindah ke sana, prodi
   * yang pindah gedung akan mencetak alamat lamanya selamanya.
   */
  it("perakit naskah memuat kop dari data langsung", () => {
    const rakit = readFileSync("src/lib/dokumen/rakit-naskah.ts", "utf8");
    assert.match(rakit, /muatKopCetak|muatKopTampil/);
    assert.ok(!/beku\.kop|snapshot\.kop/.test(rakit), "kop diambil dari salinan beku");
  });
});
