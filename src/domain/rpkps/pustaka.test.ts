import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kelompokkanPustaka, URUT_JENIS_PUSTAKA } from "./pustaka";

describe("pengelompokan pustaka", () => {
  it("mempertahankan urutan baku, bukan urutan masuk", () => {
    const hasil = kelompokkanPustaka([
      { jenis: "TOOLS", nomor: 1 },
      { jenis: "DARING", nomor: 1 },
      { jenis: "UTAMA", nomor: 1 },
      { jenis: "PENDUKUNG", nomor: 1 },
    ]);
    assert.deepEqual(
      hasil.map((h) => h.jenis),
      ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"],
    );
  });

  /**
   * Inti persoalannya: `@@unique([rpkpsId, jenis, nomor])` membuat penomoran
   * mulai dari satu lagi di tiap jenis. Dua butir bernomor 1 adalah dua bahan
   * yang berbeda, dan keduanya harus keluar sebagai dua kelompok — kalau
   * pengelompokannya jatuh ke `nomor`, salah satunya lenyap dari dokumen.
   */
  it("nomor yang sama pada jenis berbeda tetap dua rujukan", () => {
    const hasil = kelompokkanPustaka([
      { jenis: "UTAMA", nomor: 1 },
      { jenis: "DARING", nomor: 1 },
    ]);
    assert.deepEqual(hasil, [
      { jenis: "UTAMA", butir: [{ jenis: "UTAMA", nomor: 1 }] },
      { jenis: "DARING", butir: [{ jenis: "DARING", nomor: 1 }] },
    ]);
  });

  it("menomori menaik di dalam kelompok", () => {
    const [kelompok] = kelompokkanPustaka([
      { jenis: "UTAMA", nomor: 3 },
      { jenis: "UTAMA", nomor: 1 },
      { jenis: "UTAMA", nomor: 2 },
    ]);
    assert.deepEqual(kelompok.butir.map((b) => b.nomor), [1, 2, 3]);
  });

  it("tidak memunculkan kelompok kosong", () => {
    assert.deepEqual(kelompokkanPustaka([]), []);
    assert.deepEqual(
      kelompokkanPustaka([{ jenis: "DARING", nomor: 2 }]).map((h) => h.jenis),
      ["DARING"],
    );
  });

  /**
   * Penjaga anggota enum yang ditambahkan tanpa menyentuh berkas ini: akibat
   * yang dapat diterima adalah tercetak di urutan yang salah, BUKAN hilang
   * dari dokumen tanpa satu pesan pun.
   */
  it("jenis yang belum dikenal ikut di belakang, tidak dibuang", () => {
    const hasil = kelompokkanPustaka([
      { jenis: "JURNAL", nomor: 1 },
      { jenis: "UTAMA", nomor: 1 },
    ]);
    assert.deepEqual(hasil.map((h) => h.jenis), ["UTAMA", "JURNAL"]);
  });

  it("urutan baku memuat seluruh anggota enum yang dipakai dokumen", () => {
    assert.deepEqual(
      [...URUT_JENIS_PUSTAKA].sort(),
      ["DARING", "PENDUKUNG", "TOOLS", "UTAMA"],
    );
  });
});
