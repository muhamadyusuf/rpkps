import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import {
  HALAMAN_MINIMAL,
  periksaKesiapanTerbit,
  type BukuKesiapan,
} from "./kesiapan-terbit";

function buku(ubah: Partial<BukuKesiapan> = {}): BukuKesiapan {
  return {
    judul: "Struktur Data dan Algoritma",
    penulis: ["Dr. Contoh, S.T., M.T."],
    penerbit: "Penerbit ITTS",
    kotaTerbit: "Tangerang Selatan",
    tahunTerbit: 2026,
    isbn: "978-3-16-148410-0",
    prakata: "Buku ini disusun untuk mahasiswa semester tiga.",
    sinopsis: "Buku ini membahas struktur data dan algoritma dasar.",
    kataKunci: ["struktur data", "algoritma"],
    glosarium: [{ istilah: "Rekursi" }],
    pustaka: [{ nomor: 1 }],
    bab: Array.from({ length: 8 }, (_, i) => ({
      nomor: i + 1,
      adaUraian: true,
      disunting: true,
    })),
    // 8 bab × ±2.500 kata; jauh di atas ambang.
    jumlahKata: 20_000,
    usulanTerbuka: 0,
    ...ubah,
  };
}

function kode(b: BukuKesiapan): string[] {
  return periksaKesiapanTerbit(b).temuan.map((t) => t.kode);
}

describe("kesiapan terbit", () => {
  it("naskah lengkap dinyatakan siap, tanpa satu temuan pun", () => {
    const hasil = periksaKesiapanTerbit(buku());
    assert.deepEqual(hasil.temuan, []);
    assert.equal(hasil.siap, true);
    assert.equal(hasil.ringkasan.jumlahBab, 8);
  });

  it("metadata yang kurang memblokir", () => {
    const hasil = periksaKesiapanTerbit(buku({ penerbit: null, tahunTerbit: null }));
    const t = hasil.temuan.find((x) => x.kode === "KT-METADATA");
    assert.equal(t?.params?.jumlah, 2);
    assert.equal(hasil.siap, false);
  });

  it("ISBN WAJIB di sini, tidak seperti pada pemeriksaan cetak", () => {
    /*
     * `periksaBukuAjar` hanya menolak ISBN yang salah ketik — pertanyaannya
     * "bolehkah dicetak". Di sini pertanyaannya "bolehkah diserahkan sebagai
     * terbitan", dan terbitan tanpa ISBN belum menjadi terbitan.
     */
    assert.ok(kode(buku({ isbn: null })).includes("KT-ISBN"));
    assert.ok(kode(buku({ isbn: "978-3-16-148410-1" })).includes("KT-ISBN"));
  });

  it("naskah setipis pamflet memblokir, beserta taksirannya", () => {
    const tipis = periksaKesiapanTerbit(buku({ jumlahKata: 3_000 }));
    const t = tipis.temuan.find((x) => x.kode === "KT-HALAMAN");
    assert.equal(t?.params?.n, HALAMAN_MINIMAL);
    assert.equal(t?.params?.taksiran, 9);
  });

  it("bab kosong dan bab yang belum disunting memblokir", () => {
    const b = buku({
      bab: [
        { nomor: 1, adaUraian: true, disunting: true },
        { nomor: 2, adaUraian: false, disunting: false },
        { nomor: 3, adaUraian: true, disunting: false },
      ],
    });
    const semua = kode(b);
    assert.ok(semua.includes("KT-BAB-KOSONG"));
    assert.ok(semua.includes("KT-BELUM-DISUNTING"));
    // Bab kosong tidak dihitung dua kali sebagai "belum disunting".
    const t = periksaKesiapanTerbit(b).temuan.find((x) => x.kode === "KT-BELUM-DISUNTING");
    assert.equal(t?.params?.jumlah, 1);
  });

  it("usulan yang menggantung memperingatkan, tidak memblokir", () => {
    const hasil = periksaKesiapanTerbit(buku({ usulanTerbuka: 7 }));
    const t = hasil.temuan.find((x) => x.kode === "KT-USULAN-TERBUKA");
    assert.equal(t?.tingkat, "PERINGATAN");
    assert.equal(t?.params?.jumlah, 7);
    assert.equal(hasil.siap, true, "usulan terbuka seharusnya tidak memblokir");
  });

  it("glosarium kosong memperingatkan; prakata dan pustaka kosong memblokir", () => {
    // Glosarium wajar tidak ada pada buku bidang tertentu; prakata dan daftar
    // pustaka tidak.
    const tanpaGlosarium = periksaKesiapanTerbit(buku({ glosarium: [] }));
    assert.equal(tanpaGlosarium.siap, true);

    assert.equal(periksaKesiapanTerbit(buku({ prakata: null })).siap, false);
    assert.equal(periksaKesiapanTerbit(buku({ pustaka: [] })).siap, false);
  });

  it("sinopsis tanpa kata kunci tetap dianggap belum ada", () => {
    assert.ok(kode(buku({ kataKunci: [] })).includes("KT-TANPA-SINOPSIS"));
    assert.ok(kode(buku({ sinopsis: "  " })).includes("KT-TANPA-SINOPSIS"));
  });

  it("setiap temuan punya kalimatnya, dengan penanda terisi", () => {
    const hasil = periksaKesiapanTerbit(
      buku({
        penerbit: null,
        isbn: null,
        jumlahKata: 500,
        prakata: null,
        sinopsis: null,
        kataKunci: [],
        glosarium: [],
        pustaka: [],
        usulanTerbuka: 3,
        bab: [
          { nomor: 1, adaUraian: false, disunting: false },
          { nomor: 2, adaUraian: true, disunting: false },
        ],
      }),
    );
    assert.ok(hasil.temuan.length >= 9);
    for (const t of hasil.temuan) {
      const pesan = pesanTemuanId(t);
      assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${t.kode}: ${pesan}`);
      assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
    }
  });
});
