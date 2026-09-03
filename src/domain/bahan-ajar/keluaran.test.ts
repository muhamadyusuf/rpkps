import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { rapikanIsiBab, rapikanKelengkapan, rapikanSlide } from "./keluaran";
import { periksaBukuAjar } from "./validator";
import type { BabMentah } from "./keluaran";

function mentah(ubah: Partial<BabMentah> = {}): BabMentah {
  return {
    uraian: "1. Pengantar\nParagraf penjelasan.",
    studi_kasus: "Sebuah perusahaan…",
    ringkasan: "Bab ini membahas…",
    latihan: [{ soal: "Jelaskan A.", kunci: "A adalah…", bloom: "C2" }],
    sitiran: [1, 2],
    ...ubah,
  };
}

describe("merapikan isi bab", () => {
  it("keluaran yang sudah benar tidak berubah dan tidak menimbulkan catatan", () => {
    const { hasil, catatan } = rapikanIsiBab(mentah(), {
      nomorPustakaTersedia: [1, 2, 3],
    });
    assert.deepEqual(catatan, []);
    assert.equal(hasil.uraian, "1. Pengantar\nParagraf penjelasan.");
    assert.deepEqual(hasil.sitiran, [1, 2]);
    assert.deepEqual(hasil.latihan, [
      { nomor: 1, soal: "Jelaskan A.", kunci: "A adalah…", bloom: "C2" },
    ]);
  });

  it("string kosong menjadi null", () => {
    const { hasil } = rapikanIsiBab(
      mentah({ studi_kasus: "", ringkasan: "   " }),
      { nomorPustakaTersedia: [1, 2] },
    );
    assert.equal(hasil.studiKasus, null);
    assert.equal(hasil.ringkasan, null);
  });

  it("sentinel yang dilarang panduan tetap diperlakukan sebagai kosong", () => {
    // Satu tanda hubung yang tersimpan sebagai ringkasan akan tercetak di buku
    // persis seperti itu.
    for (const nilai of ["-", "—", "null", "N/A", "tidak ada", "none"]) {
      const { hasil } = rapikanIsiBab(mentah({ ringkasan: nilai }), {
        nomorPustakaTersedia: [1, 2],
      });
      assert.equal(hasil.ringkasan, null, nilai);
    }
  });

  it("sitiran di luar daftar pustaka RPKPS dibuang dan dilaporkan", () => {
    const { hasil, catatan } = rapikanIsiBab(
      mentah({ sitiran: [1, 9, 2, 9, 12] }),
      { nomorPustakaTersedia: [1, 2, 3], bab: 4 },
    );
    assert.deepEqual(hasil.sitiran, [1, 2]);
    const t = catatan.find((c) => c.kode === "BA-SITIRAN-DIBUANG");
    assert.deepEqual(t?.params, { jumlah: 2, daftar: "9, 12" });
    assert.equal(t?.bab, 4);
    assert.equal(t?.tingkat, "INFO");
  });

  it("apa yang dibuang di sini tidak boleh menyala lagi di validator", () => {
    /*
     * Uji silang yang paling berharga di berkas ini: rapikan MEMPERBAIKI,
     * validator MEMBUKTIKAN. Bila `BA-PUSTAKA-ASING` menyala untuk keluaran
     * yang sudah lewat rapikanIsiBab, yang bocor adalah jalur pembuangannya.
     */
    const { hasil } = rapikanIsiBab(mentah({ sitiran: [1, 77] }), {
      nomorPustakaTersedia: [1, 2, 3],
    });

    const periksa = periksaBukuAjar({
      bahasa: "id",
      judul: "Buku",
      penulis: ["Dosen"],
      penerbit: "Penerbit",
      tahunTerbit: 2026,
      isbn: null,
      prakata: "Prakata.",
      nomorPustakaTersedia: [1, 2, 3],
      bab: [
        {
          nomor: 1,
          judul: "Bab 1",
          tujuan: ["Tujuan"],
          uraian: hasil.uraian,
          studiKasus: hasil.studiKasus,
          ringkasan: hasil.ringkasan,
          latihan: hasil.latihan,
          jumlahSlide: 0,
          sitiran: hasil.sitiran,
          sidikSumber: null,
          sidikSekarang: null,
          punyaMinggu: true,
          disunting: false,
        },
      ],
    });

    assert.ok(!periksa.temuan.some((t) => t.kode === "BA-PUSTAKA-ASING"));
  });

  it("soal kosong dibuang dan sisanya dinomori ulang rapat", () => {
    const { hasil, catatan } = rapikanIsiBab(
      mentah({
        latihan: [
          { soal: "Soal A", kunci: "a", bloom: "C2" },
          { soal: "   ", kunci: "b", bloom: "C2" },
          { soal: "Soal C", kunci: "", bloom: "C3" },
        ],
      }),
      { nomorPustakaTersedia: [1, 2] },
    );
    assert.deepEqual(
      hasil.latihan.map((l) => [l.nomor, l.soal, l.kunci]),
      [
        [1, "Soal A", "a"],
        [2, "Soal C", null],
      ],
    );
    assert.deepEqual(
      catatan.find((c) => c.kode === "BA-LATIHAN-KOSONG-DIBUANG")?.params,
      { jumlah: 1 },
    );
  });

  it("level Bloom asing dikosongkan, bukan menggagalkan babnya", () => {
    // Satu level yang salah tidak sebanding dengan membuang satu bab utuh
    // yang sudah dibayar kuota dosen.
    const { hasil, catatan } = rapikanIsiBab(
      mentah({ latihan: [{ soal: "Soal", kunci: "k", bloom: "c9" }] }),
      { nomorPustakaTersedia: [1, 2] },
    );
    assert.equal(hasil.latihan[0].bloom, null);
    assert.deepEqual(
      catatan.find((c) => c.kode === "BA-BLOOM-ASING")?.params,
      { daftar: "C9" },
    );
  });

  it("bloom huruf kecil tetap dikenali", () => {
    const { hasil, catatan } = rapikanIsiBab(
      mentah({ latihan: [{ soal: "Soal", kunci: "k", bloom: "c4" }] }),
      { nomorPustakaTersedia: [1, 2] },
    );
    assert.equal(hasil.latihan[0].bloom, "C4");
    assert.deepEqual(catatan, []);
  });
});

describe("merapikan slide", () => {
  it("menomori berurutan dan membuang butir kosong", () => {
    const { hasil, catatan } = rapikanSlide([
      { judul: "Pembuka", butir: ["Satu", "  ", "Dua"], catatan: "Sapa kelas." },
      { judul: "", butir: [], catatan: "" },
      { judul: "Penutup", butir: ["Tiga"], catatan: "" },
    ]);
    assert.deepEqual(
      hasil.map((s) => [s.nomor, s.judul, s.butir.length, s.catatan]),
      [
        [1, "Pembuka", 2, "Sapa kelas."],
        [2, "Penutup", 1, null],
      ],
    );
    assert.deepEqual(
      catatan.find((c) => c.kode === "BA-SLIDE-KOSONG-DIBUANG")?.params,
      { jumlah: 1 },
    );
  });

  it("slide berjudul tanpa butir tetap dipertahankan", () => {
    // Slide pemisah bab memang hanya berisi judul.
    const { hasil, catatan } = rapikanSlide([
      { judul: "Bagian II", butir: [], catatan: "" },
    ]);
    assert.equal(hasil.length, 1);
    assert.deepEqual(catatan, []);
  });
});

describe("merapikan kelengkapan", () => {
  it("glosarium diurutkan, yang berulang disatukan", () => {
    const { hasil, catatan } = rapikanKelengkapan({
      prakata: "Prakata.",
      pendahuluan: "",
      biografi: "Penulis mengampu mata kuliah ini.",
      glosarium: [
        { istilah: "Rekursi", arti: "Fungsi memanggil dirinya." },
        { istilah: "Algoritma", arti: "Langkah terbatas." },
        { istilah: "rekursi", arti: "Arti lain." },
        { istilah: "  ", arti: "tanpa istilah" },
        { istilah: "Antrean", arti: "" },
      ],
    });
    assert.deepEqual(
      hasil.glosarium.map((g) => g.istilah),
      ["Algoritma", "Rekursi"],
    );
    // Yang pertama menang; yang kedua dilaporkan, bukan diam-diam ditimpa.
    assert.equal(hasil.glosarium[1].arti, "Fungsi memanggil dirinya.");
    assert.equal(hasil.pendahuluan, null);
    assert.deepEqual(
      catatan.find((c) => c.kode === "BA-GLOSARIUM-GANDA")?.params,
      { jumlah: 1 },
    );
  });
});

describe("catatan perapian", () => {
  it("setiap catatan punya kalimatnya, dengan penanda terisi", () => {
    const semua = [
      ...rapikanIsiBab(
        mentah({
          sitiran: [99],
          latihan: [
            { soal: "", kunci: "", bloom: "C2" },
            { soal: "Soal", kunci: "k", bloom: "Z9" },
          ],
        }),
        { nomorPustakaTersedia: [1] },
      ).catatan,
      ...rapikanSlide([{ judul: "", butir: [], catatan: "" }]).catatan,
      ...rapikanKelengkapan({
        prakata: "",
        pendahuluan: "",
        biografi: "",
        glosarium: [
          { istilah: "A", arti: "satu" },
          { istilah: "a", arti: "dua" },
        ],
      }).catatan,
    ];

    assert.equal(semua.length, 5);
    for (const c of semua) {
      const pesan = pesanTemuanId(c);
      assert.ok(!pesan.includes("{"), `${c.kode}: ${pesan}`);
      assert.notEqual(pesan, c.kode, `${c.kode} belum punya kalimat`);
    }
  });
});
