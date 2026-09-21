import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { bacaHalaman, bacaKata, hitungHalaman, tautanHalaman } from "./paginasi";

describe("hitung halaman", () => {
  it("daftar kosong tetap menghasilkan satu halaman, bukan nol", () => {
    const h = hitungHalaman(0, 1, 25);
    assert.equal(h.totalHalaman, 1);
    assert.equal(h.dari, 0);
    assert.equal(h.sampai, 0);
    assert.equal(h.lewati, 0);
  });

  it("halaman kedua melewati tepat satu halaman baris", () => {
    const h = hitungHalaman(132, 2, 25);
    assert.equal(h.lewati, 25);
    assert.equal(h.dari, 26);
    assert.equal(h.sampai, 50);
    assert.equal(h.totalHalaman, 6);
  });

  it("halaman terakhir tidak melampaui jumlah baris", () => {
    const h = hitungHalaman(132, 6, 25);
    assert.equal(h.sampai, 132);
  });

  it("nomor di luar jangkauan dijepit ke halaman terakhir", () => {
    assert.equal(hitungHalaman(30, 999, 25).halaman, 2);
  });

  it("nomor negatif tidak pernah menghasilkan lewati negatif", () => {
    const h = hitungHalaman(30, -5, 25);
    assert.equal(h.halaman, 1);
    assert.equal(h.lewati, 0);
  });
});

describe("membaca query", () => {
  it("nilai bukan angka jatuh ke halaman satu", () => {
    for (const nilai of [undefined, "", "abc", "0", "-3", "1e9x"]) {
      assert.equal(bacaHalaman(nilai), 1, String(nilai));
    }
  });

  it("query berulang memakai yang pertama", () => {
    assert.equal(bacaHalaman(["3", "9"]), 3);
  });

  it("kata kunci dirapikan dan dipotong", () => {
    assert.equal(bacaKata("  basis   data \n"), "basis data");
    assert.equal(bacaKata("x".repeat(200)).length, 100);
    assert.equal(bacaKata(undefined), "");
  });
});

describe("tautan halaman", () => {
  it("halaman pertama tidak meninggalkan parameter hal", () => {
    assert.equal(tautanHalaman("/rpkps", { q: "basis" }, 1), "/rpkps?q=basis");
  });

  it("saringan lain ikut terbawa saat berpindah halaman", () => {
    assert.equal(tautanHalaman("/rpkps", { q: "basis" }, 3), "/rpkps?q=basis&hal=3");
  });

  it("nilai kosong tidak mengotori alamat", () => {
    assert.equal(tautanHalaman("/pengguna", { q: "", peran: undefined }, 2), "/pengguna?hal=2");
  });

  /**
   * Satu lembar, dua daftar berhalaman — daftar RPKPS dan daftar mata kuliah
   * yang belum punya RPKPS. Masing-masing memakai nama parameter sendiri.
   */
  it("daftar kedua memakai nama parameter sendiri", () => {
    assert.equal(
      tautanHalaman("/rpkps", {}, 2, "halbelum"),
      "/rpkps?halbelum=2",
    );
  });

  /**
   * Inti persoalannya: berpindah halaman di daftar yang satu tidak boleh
   * melempar daftar yang lain kembali ke halaman 1.
   */
  it("nomor halaman daftar lain tetap terbawa", () => {
    assert.equal(
      tautanHalaman("/rpkps", { q: "basis", hal: "3" }, 2, "halbelum"),
      "/rpkps?q=basis&hal=3&halbelum=2",
    );
    assert.equal(
      tautanHalaman("/rpkps", { q: "basis", halbelum: "2" }, 3),
      "/rpkps?q=basis&halbelum=2&hal=3",
    );
  });

  it("kembali ke halaman 1 membuang parameternya sendiri saja", () => {
    assert.equal(
      tautanHalaman("/rpkps", { hal: "3", halbelum: "2" }, 1, "halbelum"),
      "/rpkps?hal=3",
    );
  });
});

/**
 * Penjaga cacat yang berulang: daftar yang DIPOTONG, bukan dihalamankan.
 *
 * Bentuknya selalu sama — `take: UKURAN_HALAMAN` tanpa `skip` dan tanpa
 * `count`. Daftarnya berhenti di baris ke-25, sisanya tidak dapat dicapai
 * dari mana pun, dan tidak ada satu pun pesan yang mengatakannya. Ia pernah
 * ada serentak di daftar mata kuliah belum ber-RPKPS, daftar RPKPS belum
 * berbuku ajar, dan antrean keputusan usulan — yang terakhir bahkan
 * MELAPORKAN ANGKA YANG SALAH, karena jumlahnya diambil dari panjang satu
 * halaman.
 *
 * `UKURAN_HALAMAN` adalah ukuran HALAMAN. Yang dikirim ke `take` seharusnya
 * `halaman.ambil` — hasil `hitungHalaman`, yang selalu berpasangan dengan
 * `skip: halaman.lewati`. Batas yang memang disengaja (pratinjau "beberapa
 * terakhir" di dasbor, sekilas arsip) punya konstantanya sendiri yang
 * menjelaskan dirinya — `BATAS`, `ARSIP_TAMPIL` — dan itulah yang membedakan
 * keputusan dari kelalaian.
 */
describe("daftar berhalaman", () => {
  function berkasSumber(akar: string): string[] {
    const hasil: string[] = [];
    for (const nama of readdirSync(akar)) {
      const jalur = join(akar, nama);
      if (statSync(jalur).isDirectory()) {
        if (nama === "generated" || nama === "node_modules") continue;
        hasil.push(...berkasSumber(jalur));
      } else if (
        (nama.endsWith(".ts") || nama.endsWith(".tsx")) &&
        !nama.includes(".test.")
      ) {
        hasil.push(jalur);
      }
    }
    return hasil;
  }

  it("ukuran halaman tidak pernah dipakai sebagai batas potong", () => {
    const melanggar = berkasSumber("src").filter((jalur) =>
      /take:\s*UKURAN_HALAMAN/.test(readFileSync(jalur, "utf8")),
    );
    assert.deepEqual(
      melanggar,
      [],
      `daftar dipotong, bukan dihalamankan — pakai \`halaman.ambil\` beserta ` +
        `\`skip: halaman.lewati\`, atau beri batasnya konstanta sendiri:\n` +
        melanggar.join("\n"),
    );
  });
});
