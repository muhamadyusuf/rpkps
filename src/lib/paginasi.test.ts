import assert from "node:assert/strict";
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
});
