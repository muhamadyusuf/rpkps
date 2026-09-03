import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { periksaBukuAjar } from "./validator";
import type { BabInput, BukuAjarInput } from "./tipe";

function bab(nomor: number, ubah: Partial<BabInput> = {}): BabInput {
  return {
    nomor,
    judul: `Bab ${nomor}`,
    tujuan: [`Mahasiswa mampu menjelaskan pokok ${nomor}`],
    uraian: "Paragraf pembuka bab ini menjelaskan pokok bahasannya.",
    studiKasus: null,
    ringkasan: "Ringkasan bab.",
    latihan: [{ nomor: 1, soal: "Jelaskan konsep A.", kunci: "Konsep A adalah…" }],
    jumlahSlide: 10,
    sitiran: [1],
    sidikSumber: "sidik-lama",
    sidikSekarang: "sidik-lama",
    punyaMinggu: true,
    disunting: true,
    ...ubah,
  };
}

function buku(ubah: Partial<BukuAjarInput> = {}): BukuAjarInput {
  return {
    bahasa: "id",
    judul: "Struktur Data",
    penulis: ["Dr. Contoh, S.T., M.T."],
    penerbit: "Penerbit ITTS",
    tahunTerbit: 2026,
    isbn: "978-3-16-148410-0",
    prakata: "Buku ini disusun untuk mahasiswa semester tiga.",
    bab: [bab(1), bab(2)],
    nomorPustakaTersedia: [1, 2, 3],
    ...ubah,
  };
}

describe("pemeriksaan buku ajar", () => {
  it("buku yang lengkap tidak memunculkan satu temuan pun", () => {
    // Pemeriksaan yang menyala saat tidak diperlukan sama merusaknya dengan
    // pemeriksaan yang gagal menyala.
    const hasil = periksaBukuAjar(buku());
    assert.deepEqual(hasil.temuan, []);
    assert.equal(hasil.lolos, true);
    assert.deepEqual(hasil.ringkasan, {
      jumlahBab: 2,
      babBerisi: 2,
      babDisunting: 2,
      jumlahLatihan: 2,
      jumlahSlide: 20,
    });
  });

  it("buku tanpa bab adalah pemblokir", () => {
    const hasil = periksaBukuAjar(buku({ bab: [] }));
    assert.ok(hasil.pemblokir.some((t) => t.kode === "BA-TANPA-BAB"));
    assert.equal(hasil.lolos, false);
    // Buku tanpa bab tidak boleh sekaligus dituduh "seluruhnya AI": tidak ada
    // yang dapat disunting siapa pun.
    assert.ok(!hasil.temuan.some((t) => t.kode === "BA-SELURUHNYA-AI"));
  });

  it("bab tanpa uraian memblokir dan menyebut nomornya", () => {
    const hasil = periksaBukuAjar(
      buku({ bab: [bab(1), bab(2, { uraian: null }), bab(3, { uraian: "   " })] }),
    );
    const t = hasil.pemblokir.find((x) => x.kode === "BA-BAB-KOSONG");
    assert.deepEqual(t?.params, { jumlah: 2, daftar: "2, 3" });
    assert.equal(hasil.lolos, false);
  });

  it("sitiran ke pustaka yang tidak ada di RPKPS memblokir", () => {
    const hasil = periksaBukuAjar(
      buku({ bab: [bab(1, { sitiran: [1, 9] }), bab(2, { sitiran: [9, 12] })] }),
    );
    const t = hasil.pemblokir.find((x) => x.kode === "BA-PUSTAKA-ASING");
    // 9 disebut dua bab, tetapi tetap satu pustaka yang tidak ada.
    assert.deepEqual(t?.params, { jumlah: 2, daftar: "9, 12" });
  });

  it("ISBN kosong wajar; ISBN salah ketik memblokir", () => {
    const kosong = periksaBukuAjar(buku({ isbn: null }));
    assert.ok(!kosong.temuan.some((t) => t.kode === "BA-ISBN-TIDAK-SAH"));

    const salah = periksaBukuAjar(buku({ isbn: "978-3-16-148410-1" }));
    const t = salah.pemblokir.find((x) => x.kode === "BA-ISBN-TIDAK-SAH");
    assert.deepEqual(t?.params, { isbn: "978-3-16-148410-1" });
  });

  it("soal tanpa kunci jawaban diperingatkan per bab", () => {
    const hasil = periksaBukuAjar(
      buku({
        bab: [
          bab(1),
          bab(2, {
            latihan: [
              { nomor: 1, soal: "Jelaskan B.", kunci: null },
              { nomor: 2, soal: "Jelaskan C.", kunci: "C adalah…" },
            ],
          }),
        ],
      }),
    );
    const t = hasil.peringatan.find((x) => x.kode === "BA-LATIHAN-TANPA-KUNCI");
    assert.deepEqual(t?.params, { daftar: "2" });
    // Peringatan, bukan pemblokir: buku tetap boleh diunduh.
    assert.equal(hasil.lolos, true);
  });

  it("bab yang rencana minggunya sudah berubah ditandai, tidak memblokir", () => {
    const hasil = periksaBukuAjar(
      buku({ bab: [bab(1), bab(2, { sidikSekarang: "sidik-baru" })] }),
    );
    assert.deepEqual(
      hasil.peringatan.find((t) => t.kode === "BA-BAB-BERGESER")?.params,
      { daftar: "2" },
    );
    assert.equal(hasil.lolos, true);
  });

  it("bab lama tanpa sidik tidak pernah dituduh bergeser", () => {
    const hasil = periksaBukuAjar(
      buku({ bab: [bab(1, { sidikSumber: null, sidikSekarang: "apa pun" })] }),
    );
    assert.ok(!hasil.temuan.some((t) => t.kode === "BA-BAB-BERGESER"));
  });

  it("bab yang kehilangan baris mingguannya ditandai", () => {
    const hasil = periksaBukuAjar(
      buku({
        bab: [bab(1), bab(2, { punyaMinggu: false, sidikSekarang: null })],
      }),
    );
    assert.deepEqual(
      hasil.peringatan.find((t) => t.kode === "BA-MINGGU-HILANG")?.params,
      { daftar: "2" },
    );
  });

  it("buku yang belum disentuh manusia diperingatkan", () => {
    const hasil = periksaBukuAjar(
      buku({ bab: [bab(1, { disunting: false }), bab(2, { disunting: false })] }),
    );
    assert.ok(hasil.peringatan.some((t) => t.kode === "BA-SELURUHNYA-AI"));
    // Satu bab saja yang disunting sudah mematikannya — sisanya urusan dosen.
    const sebagian = periksaBukuAjar(
      buku({ bab: [bab(1, { disunting: false }), bab(2, { disunting: true })] }),
    );
    assert.ok(!sebagian.temuan.some((t) => t.kode === "BA-SELURUHNYA-AI"));
  });

  it("metadata terbitan yang kosong diperingatkan satu per satu", () => {
    const hasil = periksaBukuAjar(
      buku({ penulis: ["  "], penerbit: null, tahunTerbit: null, prakata: "" }),
    );
    const kode = hasil.peringatan.map((t) => t.kode);
    assert.ok(kode.includes("BA-TANPA-PENULIS"));
    assert.ok(kode.includes("BA-TANPA-PENERBIT"));
    assert.ok(kode.includes("BA-TANPA-TAHUN"));
    assert.ok(kode.includes("BA-TANPA-PRAKATA"));
    // Peringatan: buku boleh disusun jauh sebelum penerbitnya ditentukan.
    assert.equal(hasil.lolos, true);
  });

  it("setiap params mengisi penanda pada kalimatnya", () => {
    // Penanda yang salah nama lolos `tsc` dan tertinggal utuh sebagai
    // "{daftar}" di layar dosen.
    const hasil = periksaBukuAjar(
      buku({
        isbn: "978-3-16-148410-1",
        penulis: [],
        penerbit: null,
        tahunTerbit: null,
        prakata: null,
        bab: [
          bab(1, {
            uraian: null,
            tujuan: [],
            sitiran: [77],
            sidikSekarang: "lain",
            punyaMinggu: false,
            disunting: false,
            latihan: [{ nomor: 1, soal: "?", kunci: null }],
          }),
        ],
      }),
    );
    assert.ok(hasil.temuan.length >= 10);
    for (const t of hasil.temuan) {
      const pesan = pesanTemuanId(t);
      assert.ok(!pesan.includes("{"), `${t.kode}: ${pesan}`);
      assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
    }
  });
});
