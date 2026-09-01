import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isi, jamak, pilihDaftar, pilihTeks } from "./teks";

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

describe("pemilihan teks isi RPKPS", () => {
  it("pembaca Inggris mendapat terjemahannya bila ada", () => {
    assert.deepEqual(pilihTeks("Basis data", "Databases", "en"), {
      teks: "Databases",
      asli: false,
    });
  });

  it("pembaca Inggris jatuh ke bahasa Indonesia bila belum diterjemahkan", () => {
    assert.deepEqual(pilihTeks("Basis data", null, "en"), {
      teks: "Basis data",
      asli: true,
    });
    // Spasi kosong datang dari borang yang disentuh lalu ditinggalkan;
    // menampilkannya menghasilkan baris kosong yang tampak seperti data hilang.
    assert.deepEqual(pilihTeks("Basis data", "   ", "en"), {
      teks: "Basis data",
      asli: true,
    });
  });

  it("pembaca Indonesia TIDAK pernah melihat teks Inggris", () => {
    // Penjaga terpenting di sini: arah cadangan hanya satu. Membalik arahnya
    // memunculkan kalimat Inggris di tengah dokumen resmi berbahasa Indonesia.
    assert.deepEqual(pilihTeks("Basis data", "Databases", "id"), {
      teks: "Basis data",
      asli: true,
    });
    assert.deepEqual(pilihTeks(null, "Databases", "id"), { teks: "", asli: true });
  });

  it("daftar kosong dihitung belum diterjemahkan", () => {
    assert.deepEqual(pilihDaftar(["a", "b"], [], "en"), { teks: ["a", "b"], asli: true });
    assert.deepEqual(pilihDaftar(["a"], ["  "], "en"), { teks: ["a"], asli: true });
    assert.deepEqual(pilihDaftar(["a"], ["A"], "en"), { teks: ["A"], asli: false });
  });
});
