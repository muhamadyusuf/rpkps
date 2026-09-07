import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { naskahEn } from "./naskah-en";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Penjaga naskah cetak berbahasa Inggris.
 *
 * Dua kegagalan yang pernah terjadi, dan keduanya tidak terlihat dari tipe:
 *
 *  1. `rpkps_snapshot.isi_en` dilewatkan ke pencetak seolah-olah ia
 *     `RpkpsLengkap`. Ia bukan — ia keluaran `proyeksiIsiEn` — dan setiap
 *     unduhan Inggris atas dokumen TERBIT berakhir 500 pada `kaki()`, baris
 *     pertama yang membaca `r.tahunAkademik.kode`.
 *  2. Kolom `*En` yang tidak ikut naik. Tidak ada galat: paragrafnya sekadar
 *     tetap berbahasa Indonesia di dokumen yang dinyatakan berbahasa Inggris.
 */

/** Contoh sekecil mungkin yang tetap menyentuh setiap cabang pemetaan. */
function contoh(): RpkpsLengkap {
  return {
    deskripsi: "Mata kuliah basis data.",
    deskripsiEn: "A database course.",
    kalimatPembukaCpmk: "Setelah lulus,",
    kalimatPembukaCpmkEn: null,
    mataKuliah: {
      kode: "TI214",
      nama: "Basis Data",
      namaEn: "Databases",
      kurikulum: { prodi: { nama: "Teknik Informatika", namaEn: "Informatics" } },
      cpl: [{ cpl: { kode: "CPL-1", deskripsi: "Mampu merancang.", deskripsiEn: "Able to design." } }],
      cpmk: [
        {
          kode: "CPMK-1",
          rumusan: "Merancang basis data.",
          rumusanEn: "Design a database.",
          subCpmk: [{ kode: "Sub-1", rumusan: "Menyusun ERD.", rumusanEn: "  " }],
        },
      ],
    },
    komponenNilai: [{ nama: "UTS", namaEn: "Midterm" }],
    pertemuan: [
      {
        topik: "Model relasional",
        topikEn: "The relational model",
        subtopik: ["Tabel", "Kunci"],
        subtopikEn: [],
        metodeNarasi: "Kuliah",
        metodeNarasiEn: "Lecture",
        aktivitasDosen: null,
        aktivitasDosenEn: null,
        aktivitasMahasiswa: "Diskusi",
        aktivitasMahasiswaEn: "Discussion",
        tugasTerstruktur: null,
        tugasTerstrukturEn: null,
        penilaianJenis: "Kuis",
        penilaianJenisEn: "Quiz",
        penilaianSistem: null,
        penilaianSistemEn: null,
        subCpmk: [{ subCpmk: { kode: "Sub-1", rumusan: "Menyusun ERD.", rumusanEn: "Build an ERD." } }],
        aktivitas: [{ nama: "Ceramah", namaEn: "Lecture", kategori: "TM", menit: 50 }],
        indikator: [{ teks: "Ketepatan ERD", teksEn: "ERD accuracy" }],
      },
    ],
    kisiKisi: [
      {
        catatan: "Buku tertutup",
        catatanEn: "Closed book",
        butir: [
          {
            indikator: "Menormalisasi",
            indikatorEn: "Normalises",
            subCpmk: { kode: "Sub-1", rumusan: "Menyusun ERD.", rumusanEn: "Build an ERD." },
          },
        ],
      },
    ],
    tugas: [
      {
        nama: "Proyek",
        namaEn: "Project",
        deskripsi: "Bangun purwarupa.",
        deskripsiEn: "Build a prototype.",
        uraianTugas: null,
        uraianTugasEn: null,
        formatLuaran: "PDF",
        formatLuaranEn: null,
        ketentuanLain: null,
        ketentuanLainEn: null,
        komponenNilai: { nama: "Tugas", namaEn: "Assignment" },
        kriteria: [
          {
            indikator: "Desain",
            indikatorEn: "Design",
            rincian: ["Kardinalitas"],
            rincianEn: ["Cardinality"],
          },
        ],
        linimasa: [
          { tahapan: "Desain", tahapanEn: "Design", aktivitas: "ERD", aktivitasEn: null },
        ],
      },
    ],
  } as unknown as RpkpsLengkap;
}

describe("naskah cetak berbahasa Inggris", () => {
  const hasil = naskahEn(contoh());

  it("teks Inggris naik menggantikan pasangan Indonesianya", () => {
    assert.equal(hasil.deskripsi, "A database course.");
    assert.equal(hasil.mataKuliah.nama, "Databases");
    assert.equal(hasil.mataKuliah.kurikulum.prodi.nama, "Informatics");
    assert.equal(hasil.mataKuliah.cpl[0].cpl.deskripsi, "Able to design.");
    assert.equal(hasil.mataKuliah.cpmk[0].rumusan, "Design a database.");
    assert.equal(hasil.komponenNilai[0].nama, "Midterm");
    assert.equal(hasil.pertemuan[0].topik, "The relational model");
    assert.equal(hasil.pertemuan[0].subCpmk[0].subCpmk.rumusan, "Build an ERD.");
    assert.equal(hasil.pertemuan[0].aktivitas[0].nama, "Lecture");
    assert.equal(hasil.pertemuan[0].indikator[0].teks, "ERD accuracy");
    assert.equal(hasil.kisiKisi[0].catatan, "Closed book");
    assert.equal(hasil.kisiKisi[0].butir[0].indikator, "Normalises");
    assert.equal(hasil.kisiKisi[0].butir[0].subCpmk.rumusan, "Build an ERD.");
    assert.equal(hasil.tugas[0].nama, "Project");
    assert.equal(hasil.tugas[0].komponenNilai?.nama, "Assignment");
    assert.equal(hasil.tugas[0].kriteria[0].indikator, "Design");
    assert.deepEqual(hasil.tugas[0].kriteria[0].rincian, ["Cardinality"]);
    assert.equal(hasil.tugas[0].linimasa[0].tahapan, "Design");
  });

  it("yang belum diterjemahkan tampil apa adanya — cadangan satu arah", () => {
    assert.equal(hasil.kalimatPembukaCpmk, "Setelah lulus,");
    // Spasi saja dihitung belum diterjemahkan, sama seperti `proyeksiIsiEn`.
    assert.equal(hasil.mataKuliah.cpmk[0].subCpmk[0].rumusan, "Menyusun ERD.");
    assert.deepEqual(hasil.pertemuan[0].subtopik, ["Tabel", "Kunci"]);
    assert.equal(hasil.pertemuan[0].aktivitasDosen, null);
    assert.equal(hasil.tugas[0].formatLuaran, "PDF");
    assert.equal(hasil.tugas[0].linimasa[0].aktivitas, "ERD");
  });

  it("pengenal, angka, dan sitasi tidak ikut diterjemahkan", () => {
    assert.equal(hasil.mataKuliah.kode, "TI214");
    assert.equal(hasil.mataKuliah.cpl[0].cpl.kode, "CPL-1");
    assert.equal(hasil.mataKuliah.cpmk[0].subCpmk[0].kode, "Sub-1");
    assert.equal(hasil.pertemuan[0].aktivitas[0].menit, 50);
  });

  it("bentuknya utuh — sumbernya tidak disentuh", () => {
    const asal = contoh();
    naskahEn(asal);
    assert.equal(asal.mataKuliah.nama, "Basis Data");
    assert.equal(asal.pertemuan[0].topik, "Model relasional");
  });

  /**
   * Penjaga tekstual, karena tipe tidak dapat menangkapnya: `isi_en` bertipe
   * `JsonValue`, jadi `as unknown as RpkpsLengkap` lolos `tsc` dan hanya gagal
   * saat dijalankan.
   */
  it("perakit naskah tidak lagi mencetak dari salinan beku Inggris", () => {
    const berkas = readFileSync("src/lib/dokumen/rakit-naskah.ts", "utf8");
    const kode = berkas
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((b) => !b.trimStart().startsWith("//"))
      .join("\n");

    assert.ok(!/isiEn/.test(kode), "rakit-naskah.ts masih membaca isiEn");
    assert.match(kode, /naskahEn\(/);
  });

  /**
   * Pratinjau menjanjikan "beginilah nanti hasil unduhannya". Janji itu hanya
   * berlaku selama keduanya merakit naskahnya di satu tempat.
   */
  it("unduhan dan pratinjau merakit naskah dari satu tempat", () => {
    for (const berkas of [
      "src/lib/dokumen/siapkan-unduhan.ts",
      "src/app/[bahasa]/(app)/rpkps/[id]/pratinjau/page.tsx",
    ]) {
      assert.match(
        readFileSync(berkas, "utf8"),
        /@\/lib\/dokumen\/rakit-naskah/,
        `${berkas} merakit naskahnya sendiri`,
      );
    }
  });
});
