import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NaskahRpkps } from "./naskah";
import { labelDokumen } from "@/lib/dokumen/label";
import { naskahEn } from "@/lib/dokumen/naskah-en";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Penjaga perenderan naskah.
 *
 * Contohnya sengaja dibuat CANGGUNG — dua pengenal yang tampak unik padahal
 * tidak, menurut `prisma/schema.prisma`:
 *
 *  - `pustaka.nomor` unik per JENIS (`@@unique([rpkpsId, jenis, nomor])`),
 *    jadi satu baris mingguan boleh merujuk Sumber Utama [1] sekaligus Sumber
 *    Daring [1];
 *  - `sub_cpmk.kode` unik per CPMK (`@@unique([cpmkId, kode])`), jadi dua CPMK
 *    boleh sama-sama punya "Sub-CPMK-1".
 *
 * **Yang TIDAK dijaga berkas ini: kunci ganda.** React hanya memperingatkannya
 * saat merekonsiliasi di peramban; `renderToStaticMarkup` tidak
 * membandingkan kunci sama sekali, jadi peringatannya tidak akan pernah muncul
 * di sini betapa pun contohnya dirancang. Yang menjaga kunci majemuk pada
 * `naskah.tsx` adalah komentar di sebelahnya beserta rujukan ke skema — bukan
 * uji ini. Menghapus penyitaan konsol di bawah pun tidak akan
 * menggagalkan apa-apa untuk kasus itu.
 *
 * Yang BENAR-BENAR dijaga: naskah selesai dirender dalam kedua bahasa atas
 * data yang tidak rapi, dan React server tidak mengeluhkan susunan DOM-nya —
 * `<div>` di dalam `<p>`, sel tabel di luar baris, dan sejenisnya, yang justru
 * mudah terjadi pada dokumen setebal ini dan tidak terlihat oleh `tsc`.
 */

function contoh(): RpkpsLengkap {
  const subA = { id: "s1", kode: "Sub-CPMK-1", rumusan: "Menyusun ERD.", rumusanEn: "Build an ERD.", levelBloom: "C3", urutan: 1 };
  // Kode yang SAMA pada CPMK yang berbeda — sah menurut skema.
  const subB = { id: "s2", kode: "Sub-CPMK-1", rumusan: "Menormalisasi.", rumusanEn: "Normalise.", levelBloom: "C4", urutan: 1 };

  return {
    id: "rp1",
    versi: 1,
    status: "DRAF",
    deskripsi: "Deskripsi.",
    deskripsiEn: "Description.",
    kalimatPembukaCpmk: null,
    kalimatPembukaCpmkEn: null,
    ambangKelulusanMhs: 60,
    ambangKetercapaianMk: 70,
    minimalKehadiranPersen: 75,
    tahunAkademik: { kode: "2025/2026-GANJIL" },
    mataKuliah: {
      kode: "TI214",
      nama: "Basis Data",
      namaEn: "Databases",
      semester: 3,
      status: "WAJIB",
      sksTeori: 2,
      sksPraktik: 1,
      kurikulum: {
        nama: "Kurikulum 2024",
        tahun: 2024,
        prodi: { kode: "TI", nama: "Teknik Informatika", namaEn: "Informatics" },
      },
      cpl: [{ cpl: { kode: "CPL-1", deskripsi: "Mampu merancang.", deskripsiEn: "Able to design." } }],
      cpmk: [
        { id: "m1", kode: "CPMK-1", rumusan: "A.", rumusanEn: "A.", levelBloom: "C4", urutan: 1, cpl: [{ cpl: { kode: "CPL-1" } }], subCpmk: [subA] },
        { id: "m2", kode: "CPMK-2", rumusan: "B.", rumusanEn: "B.", levelBloom: "C4", urutan: 2, cpl: [{ cpl: { kode: "CPL-1" } }], subCpmk: [subB] },
      ],
    },
    pengampu: [
      { penggunaId: "u1", peran: "KOORDINATOR", pengguna: { id: "u1", nama: "Yusuf", gelarDepan: null, gelarBelakang: null, nidn: "1", nip: null } },
    ],
    tandaTangan: [],
    pustaka: [
      { id: "b1", jenis: "UTAMA", nomor: 1, teks: "Buku.", url: null },
      // Nomor yang SAMA pada jenis yang berbeda — sah menurut skema.
      { id: "b2", jenis: "DARING", nomor: 1, teks: "Situs.", url: "https://contoh" },
    ],
    komponenNilai: [{ id: "kn1", nama: "UTS", namaEn: "Midterm", bobot: 100, urutan: 1 }],
    kisiKisi: [
      {
        id: "kk1", jenis: "UTS", totalSkor: 100, durasiMenit: 100, catatan: null, catatanEn: null,
        butir: [
          { id: "bt1", nomor: 1, levelBloom: "C3", bentuk: "ESAI", jumlahButir: 1, skor: 50, indikator: null, indikatorEn: null, subCpmk: subA },
          { id: "bt2", nomor: 2, levelBloom: "C4", bentuk: "ESAI", jumlahButir: 1, skor: 50, indikator: null, indikatorEn: null, subCpmk: subB },
        ],
      },
    ],
    tugas: [
      {
        id: "t1", nomor: 1, nama: "Proyek", namaEn: "Project", jenis: "KELOMPOK",
        mingguMulai: 5, mingguSelesai: 12, bobot: 0, komponenNilaiId: null,
        deskripsi: "Bangun.", deskripsiEn: "Build.",
        uraianTugas: null, uraianTugasEn: null, formatLuaran: null, formatLuaranEn: null,
        ketentuanLain: null, ketentuanLainEn: null, komponenNilai: null,
        subCpmk: [{ subCpmk: { id: "s1", kode: "Sub-CPMK-1" } }],
        kriteria: [{ id: "kr1", nomor: 1, indikator: "Desain", indikatorEn: "Design", rincian: ["a", "b"], rincianEn: [], bobot: 100 }],
        linimasa: [{ id: "l1", minggu: 5, tahapan: "Desain", tahapanEn: "Design", aktivitas: "ERD", aktivitasEn: null }],
      },
    ],
    pertemuan: [
      {
        id: "p1", minggu: 1, jenis: "EFEKTIF", bobot: 0, komponenNilaiId: null,
        topik: "Model relasional", topikEn: "Relational model",
        subtopik: ["Tabel"], subtopikEn: [],
        metodeNarasi: "Kuliah", metodeNarasiEn: null,
        aktivitasDosen: null, aktivitasDosenEn: null,
        aktivitasMahasiswa: null, aktivitasMahasiswaEn: null,
        tugasTerstruktur: null, tugasTerstrukturEn: null,
        penilaianJenis: null, penilaianJenisEn: null,
        penilaianSistem: null, penilaianSistemEn: null,
        // Dua Sub-CPMK berkode sama, dari dua CPMK berbeda.
        subCpmk: [{ subCpmk: subA }, { subCpmk: subB }],
        aktivitas: [{ id: "a1", nama: "Ceramah", namaEn: "Lecture", kategori: "TM", menit: 100, urutan: 1 }],
        indikator: [{ id: "i1", teks: "Ketepatan", teksEn: "Accuracy", urutan: 1 }],
        // Dua pustaka bernomor sama, dari dua jenis berbeda.
        pustaka: [{ pustaka: { nomor: 1, jenis: "UTAMA" } }, { pustaka: { nomor: 1, jenis: "DARING" } }],
      },
      {
        id: "p8", minggu: 8, jenis: "UTS", bobot: 100, komponenNilaiId: "kn1",
        topik: null, topikEn: null, subtopik: [], subtopikEn: [],
        metodeNarasi: null, metodeNarasiEn: null,
        aktivitasDosen: null, aktivitasDosenEn: null,
        aktivitasMahasiswa: null, aktivitasMahasiswaEn: null,
        tugasTerstruktur: null, tugasTerstrukturEn: null,
        penilaianJenis: "UTS", penilaianJenisEn: "Midterm",
        penilaianSistem: null, penilaianSistemEn: null,
        subCpmk: [], aktivitas: [], indikator: [], pustaka: [],
      },
    ],
  } as unknown as RpkpsLengkap;
}

const RIWAYAT = [{ versi: 1, dibuatPada: new Date("2025-06-02"), deskripsi: "Dibuat" }];

/**
 * Merender naskah sambil menyita `console.error`/`console.warn` React —
 * keluhan susunan DOM, bukan kunci ganda (lihat catatan di atas).
 */
function renderTanpaKeluhan(bahasa: "id" | "en"): string[] {
  const keluhan: string[] = [];
  const galatAsli = console.error;
  const peringatanAsli = console.warn;
  console.error = (...a: unknown[]) => keluhan.push(a.map(String).join(" "));
  console.warn = (...a: unknown[]) => keluhan.push(a.map(String).join(" "));
  try {
    const r = bahasa === "en" ? naskahEn(contoh()) : contoh();
    renderToStaticMarkup(
      createElement(NaskahRpkps, {
        r,
        L: labelDokumen(bahasa),
        ttd: [],
        riwayat: RIWAYAT,
        sidik: null,
        bahasa,
      }),
    );
  } finally {
    console.error = galatAsli;
    console.warn = peringatanAsli;
  }
  return keluhan;
}

describe("perenderan naskah", () => {
  for (const bahasa of ["id", "en"] as const) {
    it(`dirender tanpa keluhan React (${bahasa})`, () => {
      const keluhan = renderTanpaKeluhan(bahasa);
      assert.deepEqual(keluhan, [], keluhan.join("\n"));
    });
  }

  /**
   * Bukan penjaga kunci — penjaga ISI. Sub-CPMK dari dua CPMK yang kebetulan
   * berkode sama harus sama-sama tercetak; kalau suatu saat daftarnya
   * disaring "supaya kodenya unik", inilah yang gagal.
   */
  it("kode Sub-CPMK yang berulang lintas CPMK tetap tampil dua kali", () => {
    const galatAsli = console.error;
    console.error = () => {};
    let html: string;
    try {
      html = renderToStaticMarkup(
        createElement(NaskahRpkps, {
          r: contoh(),
          L: labelDokumen("id"),
          ttd: [],
          riwayat: RIWAYAT,
          sidik: null,
          bahasa: "id" as const,
        }),
      );
    } finally {
      console.error = galatAsli;
    }
    assert.ok(html.includes("Menyusun ERD."), "rumusan Sub-CPMK CPMK-1 hilang");
    assert.ok(html.includes("Menormalisasi."), "rumusan Sub-CPMK CPMK-2 hilang");
  });
});

/**
 * Naskah berbahasa Inggris harus benar-benar berbahasa Inggris.
 *
 * Kalimat yang tertulis mati di perendernya lolos setiap pemeriksaan: `tsc`
 * melihat `string`, penjaga kamus tidak melihatnya sama sekali karena ia
 * memang tidak ada di kamus, dan hasilnya berkas "English" yang baris
 * statusnya berbunyi "Wajib".
 */
describe("naskah berbahasa Inggris", () => {
  const galatAsli = console.error;
  console.error = () => {};
  let html: string;
  try {
    html = renderToStaticMarkup(
      createElement(NaskahRpkps, {
        r: naskahEn(contoh()),
        L: labelDokumen("en"),
        ttd: [],
        riwayat: RIWAYAT,
        sidik: null,
        bahasa: "en" as const,
      }),
    );
  } finally {
    console.error = galatAsli;
  }

  it("memakai kata Inggris pada medan yang dulu tertulis mati", () => {
    for (const kata of [
      "Learning Plan :",
      "Compulsory",
      "Group Assignment",
      "Midterm Examination",
    ]) {
      assert.ok(html.includes(kata), `tidak menemukan "${kata}"`);
    }
  });

  it("tidak menyisakan kata Indonesia dari perendernya", () => {
    for (const kata of [
      "Rencana Pembelajaran :",
      "Tugas Individu",
      "Ujian Tengah Semester",
      "Ujian Akhir Semester",
    ]) {
      assert.ok(!html.includes(kata), `masih memuat "${kata}"`);
    }
  });
});

/**
 * Pratinjau berjanji "beginilah nanti hasil unduhannya". Janji itu punya satu
 * ukuran yang dapat diperiksa mesin: kedua perender mencetak kata-kata yang
 * SAMA, dari tabel label yang sama. Sebuah label yang dipakai pencetak tetapi
 * tidak oleh pratinjau berarti ada bagian dokumen yang hanya muncul di
 * berkasnya — dan tidak ada galat yang memberitahukannya.
 */
describe("pratinjau dan pencetak memakai label yang sama", () => {
  function labelDipakai(berkas: string): Set<string> {
    const kode = readFileSync(berkas, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((b) => !b.trimStart().startsWith("//"))
      .join("\n");
    return new Set([...kode.matchAll(/\bL\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  }

  const dariDocx = labelDipakai("src/lib/dokumen/rpkps-docx.ts");
  const dariPratinjau = labelDipakai(
    "src/app/[bahasa]/(app)/rpkps/[id]/pratinjau/naskah.tsx",
  );

  it("tidak ada label yang hanya dipakai salah satu", () => {
    assert.deepEqual(
      [...dariDocx].filter((x) => !dariPratinjau.has(x)).sort(),
      [],
      "dicetak ke DOCX tetapi tidak ke pratinjau",
    );
    assert.deepEqual(
      [...dariPratinjau].filter((x) => !dariDocx.has(x)).sort(),
      [],
      "tampil di pratinjau tetapi tidak di DOCX",
    );
  });
});
