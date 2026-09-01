import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isi, jamak } from "./teks";

describe("perakit kalimat", () => {
  it("mengganti penanda dengan nilainya", () => {
    assert.equal(isi("{jumlah} belum dibaca", { jumlah: 4 }), "4 belum dibaca");
    assert.equal(isi("{a} dan {b}", { a: "x", b: "y" }), "x dan y");
  });

  it("membiarkan penanda tanpa pasangan tetap terlihat", () => {
    // Sengaja: "{jumlah} belum dibaca" yang bocor ke layar langsung
    // ketahuan, sedangkan " belum dibaca" tampak seperti kalimat yang
    // memang begitu dan bertahan berbulan-bulan.
    assert.equal(isi("{jumlah} belum dibaca"), "{jumlah} belum dibaca");
  });

  it("tanpa sisipan, pola tanpa penanda tidak berubah", () => {
    assert.equal(isi("Simpan"), "Simpan");
  });

  it("jamak memilih bentuk menurut kaidah bahasanya", () => {
    const pola = { satu: "{n} meeting", banyak: "{n} meetings" };
    assert.equal(jamak(pola, 1, "en"), "1 meeting");
    assert.equal(jamak(pola, 12, "en"), "12 meetings");
    assert.equal(jamak(pola, 0, "en"), "0 meetings");
  });

  it("bahasa Indonesia memakai satu bentuk untuk semua jumlah", () => {
    const pola = { satu: "{n} pertemuan", banyak: "{n} pertemuan" };
    assert.equal(jamak(pola, 1, "id"), "1 pertemuan");
    assert.equal(jamak(pola, 12, "id"), "12 pertemuan");
  });
});
