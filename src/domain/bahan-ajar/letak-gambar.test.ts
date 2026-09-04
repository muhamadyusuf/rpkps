import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import {
  nomorGambar,
  normalkanJudul,
  tempatkanGambar,
  urutanCetakGambar,
} from "./letak-gambar";

const SUBBAB = ["1. Pengertian Rekursi", "2. Menelusuri Pemanggilan", "3. Rekursi dan Iterasi"];

function g(nomor: number, letak: string | null) {
  return { nomor, judul: `Gambar ${nomor}`, letak };
}

describe("penempatan gambar", () => {
  it("gambar menyusul subbab yang disebutnya", () => {
    const hasil = tempatkanGambar(SUBBAB, [g(1, "2. Menelusuri Pemanggilan")]);
    assert.deepEqual(
      hasil.penempatan.map((p) => [p.indeksSubbab, p.gambar.map((x) => x.nomor)]),
      [[1, [1]]],
    );
    assert.deepEqual(hasil.asing, []);
  });

  it("pencocokan mengabaikan penomoran, spasi ganda, dan besar-kecil huruf", () => {
    // Tiga hal itulah yang paling sering berbeda antara `letak` yang ditulis
    // model dan judul subbab yang ditulisnya sendiri di dalam uraian.
    for (const letak of [
      "Menelusuri Pemanggilan",
      "2.  menelusuri   pemanggilan",
      "  2. MENELUSURI PEMANGGILAN  ",
    ]) {
      const hasil = tempatkanGambar(SUBBAB, [g(1, letak)]);
      assert.equal(hasil.penempatan[0].indeksSubbab, 1, letak);
      assert.deepEqual(hasil.asing, [], letak);
    }
  });

  it("letak yang tidak dikenali JATUH KE AKHIR BAB, tidak pernah hilang", () => {
    /*
     * Kegagalan paling mahal di modul ini adalah gambar yang lenyap diam-diam:
     * dosen menyetujui sepuluh diagram, mencetak bukunya, dan menemukan tujuh.
     */
    const hasil = tempatkanGambar(SUBBAB, [g(1, "Subbab yang tidak ada"), g(2, null)]);
    const akhir = hasil.penempatan.find((p) => p.indeksSubbab === null);
    assert.deepEqual(akhir?.gambar.map((x) => x.nomor), [1, 2]);
    assert.deepEqual(hasil.asing, ["Subbab yang tidak ada"]);
    assert.deepEqual(hasil.temuan.map((t) => t.kode), ["IL-LETAK-ASING"]);
  });

  it("beberapa gambar pada satu subbab tetap berurutan", () => {
    const hasil = tempatkanGambar(SUBBAB, [
      g(3, "1. Pengertian Rekursi"),
      g(1, "1. Pengertian Rekursi"),
      g(2, "1. Pengertian Rekursi"),
    ]);
    assert.deepEqual(hasil.penempatan[0].gambar.map((x) => x.nomor), [1, 2, 3]);
  });

  it("penempatan diurutkan menurut subbabnya, akhir bab paling belakang", () => {
    const hasil = tempatkanGambar(SUBBAB, [
      g(1, "3. Rekursi dan Iterasi"),
      g(2, null),
      g(3, "1. Pengertian Rekursi"),
    ]);
    assert.deepEqual(
      hasil.penempatan.map((p) => p.indeksSubbab),
      [0, 2, null],
    );
  });

  it("bab tanpa subbab menaruh semuanya di akhir", () => {
    const hasil = tempatkanGambar([], [g(1, "Apa pun")]);
    assert.deepEqual(hasil.penempatan.map((p) => p.indeksSubbab), [null]);
    assert.deepEqual(hasil.asing, ["Apa pun"]);
  });

  it("bab tanpa gambar tidak menghasilkan penempatan apa pun", () => {
    const hasil = tempatkanGambar(SUBBAB, []);
    assert.deepEqual(hasil.penempatan, []);
    assert.deepEqual(hasil.temuan, []);
  });

  it("judul subbab yang berulang memilih yang pertama", () => {
    const hasil = tempatkanGambar(["A", "B", "A"], [g(1, "A")]);
    assert.equal(hasil.penempatan[0].indeksSubbab, 0);
  });
});

describe("penomoran gambar", () => {
  it("nomor cetak menggabungkan nomor bab dan urutan cetak", () => {
    assert.equal(nomorGambar(3, 2), "3.2");
  });

  it("urutan cetak runtut walau ada gambar yang jatuh ke akhir bab", () => {
    // Nomor tersimpannya 5, 1, 9 — nomor cetaknya tetap 1, 2, 3.
    const hasil = tempatkanGambar(SUBBAB, [
      g(5, "3. Rekursi dan Iterasi"),
      g(1, "1. Pengertian Rekursi"),
      g(9, "entah"),
    ]);
    assert.deepEqual(
      urutanCetakGambar(hasil, 4).map((x) => [x.gambar.nomor, x.nomorCetak]),
      [
        [1, "4.1"],
        [5, "4.2"],
        [9, "4.3"],
      ],
    );
  });
});

describe("normalisasi judul", () => {
  it("membuang penomoran bertingkat dan merapatkan spasi", () => {
    assert.equal(normalkanJudul("2.1.  Pohon   Biner "), "pohon biner");
    assert.equal(normalkanJudul("Pohon Biner"), "pohon biner");
  });

  it("angka di depan dibuang walau tanpa titik, dan itu aman", () => {
    /*
     * "3 Cara Menelusuri" kehilangan angkanya di sini — termasuk bila angka
     * itu sebenarnya bagian judul. Itu disengaja: normalisasi dikenakan pada
     * KEDUA sisi perbandingan, jadi judul subbab dan `letak` yang menyebutnya
     * sama-sama kehilangan angka yang sama dan tetap bertemu. Yang dibeli
     * adalah kecocokan untuk kasus yang jauh lebih sering terjadi — model
     * menulis "2 Menelusuri" sementara subbabnya "2. Menelusuri".
     *
     * Kerugiannya hanya muncul bila dua subbab berbeda HANYA pada angka
     * depannya, dan bila itu terjadi yang pertama yang menang.
     */
    assert.equal(normalkanJudul("3 Cara Menelusuri"), "cara menelusuri");
    assert.equal(normalkanJudul("3. Cara Menelusuri"), "cara menelusuri");
  });
});

describe("kalimat temuan letak", () => {
  it("penanda terisi", () => {
    const hasil = tempatkanGambar(SUBBAB, [g(1, "entah")]);
    for (const t of hasil.temuan) {
      const pesan = pesanTemuanId(t);
      assert.ok(!pesan.includes("{"), pesan);
      assert.notEqual(pesan, t.kode);
    }
  });
});
