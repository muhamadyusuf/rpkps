import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buatJadwalCabut } from "./cabut-sesi";

const SELANG = 5 * 60 * 1000;

describe("jadwal pemeriksaan pencabutan sesi", () => {
  it("cookie yang belum pernah diperiksa selalu diperiksa", () => {
    const j = buatJadwalCabut(SELANG);
    assert.equal(j.perluPeriksa("a", 0), true);
  });

  it("dalam satu selang, pemeriksaan berikutnya dilewati", () => {
    const j = buatJadwalCabut(SELANG);
    j.catat("a", 0);
    assert.equal(j.perluPeriksa("a", 1), false);
    assert.equal(j.perluPeriksa("a", SELANG - 1), false);
  });

  it("tepat di ujung selang, pemeriksaan dilakukan lagi", () => {
    const j = buatJadwalCabut(SELANG);
    j.catat("a", 0);
    assert.equal(j.perluPeriksa("a", SELANG), true);
    assert.equal(j.perluPeriksa("a", SELANG + 1), true);
  });

  it("izin-lewat satu cookie tidak menular ke cookie lain", () => {
    const j = buatJadwalCabut(SELANG);
    j.catat("a", 0);
    assert.equal(j.perluPeriksa("b", 1), true);
  });

  it("melupakan cookie memaksa pemeriksaan penuh berikutnya", () => {
    // Inilah yang menjaga cookie yang ditolak: kalau penolakannya justru
    // karena pencabutan, entri lama akan membuat permintaan berikutnya
    // melewatkan pemeriksaan yang baru saja gagal.
    const j = buatJadwalCabut(SELANG);
    j.catat("a", 0);
    j.lupakan("a");
    assert.equal(j.perluPeriksa("a", 1), true);
  });

  it("peta tidak tumbuh melewati batas", () => {
    const j = buatJadwalCabut(SELANG, 10);
    for (let i = 0; i < 100; i++) j.catat(`k${i}`, 0);
    assert.ok(j.jumlah <= 10, `jumlah entri ${j.jumlah} melewati batas 10`);
  });

  it("saat penuh, entri kedaluwarsa yang dibuang lebih dulu", () => {
    const j = buatJadwalCabut(SELANG, 3);
    j.catat("lama", 0);
    j.catat("b", SELANG);
    j.catat("c", SELANG);
    // "lama" sudah lewat selangnya pada t = SELANG + 1; ia yang harus pergi.
    j.catat("d", SELANG + 1);
    assert.equal(j.perluPeriksa("b", SELANG + 1), false);
    assert.equal(j.perluPeriksa("c", SELANG + 1), false);
    assert.equal(j.perluPeriksa("d", SELANG + 1), false);
  });

  it("mencatat ulang kunci yang sudah ada tidak menambah entri", () => {
    const j = buatJadwalCabut(SELANG, 3);
    j.catat("a", 0);
    j.catat("a", SELANG);
    j.catat("a", SELANG * 2);
    assert.equal(j.jumlah, 1);
  });
});
