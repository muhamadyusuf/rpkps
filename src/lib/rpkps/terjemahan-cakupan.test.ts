import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { kelompokkanTerjemahan } from "./terjemahan-tulis";
import { MEDAN_BOLEH } from "./medan-en";

/**
 * Penjaga CAKUPAN terjemahan (docs/11 §8.2).
 *
 * Bug yang ditutupnya: angka "Kelengkapan terjemahan" dan daftar medan yang
 * dikirim ke AI dulu adalah DUA daftar yang ditulis terpisah. Penyebutnya
 * memuat `subtopik` dan `rincian`; yang ditawarkan ke model tidak. Akibatnya
 * "Terjemahkan yang belum" selalu berhenti di bawah 100% pada dokumen mana pun
 * yang punya subtopik — dan tidak ada satu tombol pun di aplikasi ini yang
 * dapat menutup sisanya.
 *
 * Sekarang ada satu rantai: `medanRpkps` → alamat → `MEDAN_BOLEH` → SQL, dan
 * `pasanganTerjemahan` diturunkan dari ujung pertamanya. Penjaganya harus
 * TEKSTUAL untuk bagian yang menyentuh `RpkpsLengkap`: berkas itu
 * `server-only`, tidak dapat diimpor pelari uji.
 */

const SKEMA = readFileSync("prisma/schema.prisma", "utf8");
const MEDAN = readFileSync("src/lib/rpkps/terjemahan.ts", "utf8");

/** Kolom `*En` milik sebuah model Prisma, beserta tipenya. */
function kolomEn(model: string): { nama: string; tipe: string }[] {
  const m = SKEMA.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${model} tidak ditemukan di schema.prisma`);
  return [...m[1].matchAll(/^\s+(\w+En)\s+(\S+)/gm)].map((x) => ({ nama: x[1], tipe: x[2] }));
}

/** Model isi RPKPS → properti klien Prisma yang mewakilinya di alamat medan. */
const ISI_RPKPS: Record<string, string> = {
  Rpkps: "rpkps",
  Pertemuan: "pertemuan",
  Indikator: "indikator",
  AktivitasBelajar: "aktivitasBelajar",
  KomponenNilai: "komponenNilai",
  Tugas: "tugas",
  KriteriaTugas: "kriteriaTugas",
  LinimasaTugas: "linimasaTugas",
  KisiKisi: "kisiKisi",
  ButirKisiKisi: "butirKisiKisi",
};

describe("cakupan medan terjemahan", () => {
  for (const [model, properti] of Object.entries(ISI_RPKPS)) {
    for (const { nama, tipe } of kolomEn(model)) {
      it(`${model}.${nama} dapat ditulis lewat MEDAN_BOLEH`, () => {
        // Kolom `*En` yang tidak ada di daftar putih adalah pekerjaan yang
        // dihitung tetapi tidak pernah dapat diselesaikan siapa pun.
        const izin = MEDAN_BOLEH[properti];
        assert.ok(izin, `${properti} tidak ada di MEDAN_BOLEH`);
        const larik = tipe.startsWith("String[");
        const daftar = larik ? izin.larik : izin.kolom;
        assert.ok(
          daftar && nama in daftar,
          `${model}.${nama} (${tipe}) tidak terdaftar di ${larik ? "larik" : "kolom"}`,
        );
      });

      it(`${model}.${nama} ditawarkan oleh medanRpkps`, () => {
        // Penjaga tekstual, dengan alasan yang sama seperti `terjemahan.test.ts`:
        // `medanRpkps` hidup di modul `server-only`. Sebuah kolom yang ada di
        // skema dan di daftar putih tetapi tidak pernah disusun menjadi alamat
        // tidak akan pernah sampai ke model.
        assert.ok(
          MEDAN.includes(`"${nama}"`) || MEDAN.includes(`:${nama}\``),
          `terjemahan.ts tidak menyusun alamat untuk ${model}.${nama}`,
        );
      });
    }
  }

  it("kelengkapan diturunkan dari medanRpkps, bukan daftar kedua", () => {
    /*
     * Inti perbaikannya. Selama `pasanganTerjemahan` menyusun daftarnya
     * sendiri, ia dapat menghitung medan yang tidak pernah ditawarkan ke AI —
     * dan angka kelengkapan menjadi target yang tidak dapat dicapai. Diturunkan
     * seperti ini, penyebutnya SELALU sama dengan yang dapat dikerjakan.
     */
    assert.match(
      MEDAN,
      /export function pasanganTerjemahan\([^)]*\): PasanganTeks\[\] \{\s*return medanRpkps\(r\)\.map\(/,
    );
  });
});

describe("penerapan terjemahan larik", () => {
  const sah = new Set([
    "pertemuan:p1:subtopikEn#0",
    "pertemuan:p1:subtopikEn#2",
    "pertemuan:p1:topikEn",
  ]);
  const sekarang = new Map([["pertemuan:p1:subtopikEn", ["", "Sudah ada", ""]]]);

  it("menulis larik UTUH, bukan elemen di tempat", () => {
    // Postgres tidak dapat mengisi satu elemen tanpa meninggalkan NULL di
    // posisi yang belum terisi, dan `String[]` Prisma menolak membacanya.
    const h = kelompokkanTerjemahan(
      sah,
      [
        { alamat: "pertemuan:p1:subtopikEn#0", teks: "First" },
        { alamat: "pertemuan:p1:subtopikEn#2", teks: "Third" },
      ],
      sekarang,
    );
    assert.equal(h.jumlah, 2);
    assert.deepEqual(h.larik, [
      {
        tabel: "pertemuan",
        kolom: "subtopik_en",
        baris: [{ id: "p1", teks: ["First", "Sudah ada", "Third"] }],
      },
    ]);
  });

  it("elemen yang tidak dipilih tetap seperti sebelumnya", () => {
    // Dosen boleh menerapkan satu subtopik saja; yang sudah diterjemahkan lebih
    // dulu tidak boleh ikut terhapus.
    const h = kelompokkanTerjemahan(
      sah,
      [{ alamat: "pertemuan:p1:subtopikEn#0", teks: "First" }],
      sekarang,
    );
    assert.deepEqual(h.larik[0].baris[0].teks, ["First", "Sudah ada", ""]);
  });

  it("kolom biasa dan kolom larik tidak tercampur", () => {
    const h = kelompokkanTerjemahan(
      sah,
      [
        { alamat: "pertemuan:p1:topikEn", teks: "Introduction" },
        { alamat: "pertemuan:p1:subtopikEn#0", teks: "First" },
      ],
      sekarang,
    );
    assert.deepEqual(h.kelompok, [
      { tabel: "pertemuan", kolom: "topik_en", baris: [{ id: "p1", teks: "Introduction" }] },
    ]);
    assert.equal(h.larik.length, 1);
    assert.equal(h.jumlah, 2);
  });

  it("indeks di luar jangkauan larik Indonesia dilewati", () => {
    // Alamat datang dari peramban, dan dokumen boleh berubah selagi dosen
    // meninjau. Menulis indeks 9 pada larik berisi tiga elemen akan mengarang
    // enam elemen kosong di antaranya.
    const h = kelompokkanTerjemahan(
      new Set(["pertemuan:p1:subtopikEn#9"]),
      [{ alamat: "pertemuan:p1:subtopikEn#9", teks: "Nowhere" }],
      sekarang,
    );
    assert.equal(h.jumlah, 0);
    assert.deepEqual(h.larik, []);
  });

  it("tanpa larik dasar tidak ada yang ditulis", () => {
    // Baris yang tidak ada di dokumen yang baru dimuat bukan milik RPKPS ini.
    const h = kelompokkanTerjemahan(
      new Set(["pertemuan:p9:subtopikEn#0"]),
      [{ alamat: "pertemuan:p9:subtopikEn#0", teks: "X" }],
      sekarang,
    );
    assert.equal(h.jumlah, 0);
  });

  it("alamat berindeks pada kolom yang bukan larik ditolak", () => {
    // `topik_en` bertipe `text`; menulis `text[]` ke sana adalah galat SQL yang
    // baru muncul pada dokumen dosen sungguhan.
    const h = kelompokkanTerjemahan(
      new Set(["pertemuan:p1:topikEn#0"]),
      [{ alamat: "pertemuan:p1:topikEn#0", teks: "X" }],
      sekarang,
    );
    assert.equal(h.jumlah, 0);
  });
});
