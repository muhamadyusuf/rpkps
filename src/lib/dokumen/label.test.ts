import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { labelDokumenEn, labelDokumenId, type LabelDokumen } from "./label";

/** Setiap nilai string di dalam tabel label, dirata-jalurkan. */
function semuaLabel(o: unknown, jalur = ""): [string, string][] {
  if (typeof o === "string") return [[jalur, o]];
  if (Array.isArray(o)) return o.flatMap((x, i) => semuaLabel(x, `${jalur}[${i}]`));
  if (o !== null && typeof o === "object") {
    return Object.entries(o).flatMap(([k, v]) => semuaLabel(v, jalur ? `${jalur}.${k}` : k));
  }
  return [];
}

/** Penanda `{nama}` pada sebuah pola. */
function penanda(pola: string): Set<string> {
  return new Set([...pola.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

describe("tabel label dokumen", () => {
  it("kedua bahasa punya kunci dan bentuk yang sama", () => {
    const a = semuaLabel(labelDokumenId).map(([j]) => j);
    const b = semuaLabel(labelDokumenEn as LabelDokumen).map(([j]) => j);
    assert.deepEqual(b, a);
  });

  it("penanda tidak berubah saat diterjemahkan", () => {
    // "{pertemuan}" yang salah ketik menjadi "{meetings}" lolos `tsc` —
    // keduanya `string` — dan muncul di berkas cetak sebagai "{meetings}".
    const en = new Map(semuaLabel(labelDokumenEn as LabelDokumen));
    for (const [jalur, teks] of semuaLabel(labelDokumenId)) {
      assert.deepEqual(penanda(en.get(jalur) ?? ""), penanda(teks), jalur);
    }
  });

  it("tidak ada kalimat Inggris yang tertinggal sama dengan Indonesianya", () => {
    const en = new Map(semuaLabel(labelDokumenEn as LabelDokumen));
    const sama: string[] = [];
    for (const [jalur, teks] of semuaLabel(labelDokumenId)) {
      const b = en.get(jalur) ?? "";
      // Sebagian label memang identik: pengenal ("CPMK", "NIDN / NIP / NIK"),
      // pola murni penanda, dan nama institusi.
      const kata = teks.replace(/\{\w+\}/g, "").replace(/[^A-Za-z ]/g, " ");
      if (teks === b && /\b[a-z]{4,}\b/.test(kata)) sama.push(jalur);
    }
    assert.deepEqual(sama, [], `belum diterjemahkan: ${sama.join(", ")}`);
  });
});

/**
 * Pengenal berkas Excel — judul kolom dan nama lembar yang dicocokkan saat
 * berkas diunggah kembali.
 *
 * Berkas nilai dan templat kurikulum dibaca ulang dengan MENCOCOKKAN TEKS
 * judulnya. Menerjemahkan salah satunya membuat berkas yang diunduh dalam
 * bahasa Inggris tidak dapat diunggah kembali — dan gagalnya senyap: pembaca
 * hanya melaporkan "kolom tidak ditemukan" (docs/11 §7).
 */
const PENGENAL = [
  "NIM",
  "Nama",
  "Angkatan",
  "Nilai",
  "Petunjuk",
  "Profil Lulusan",
  "Mata Kuliah",
  "Sub-CPMK",
  "Kode PL",
  "Kode CPL",
  "Kode MK",
  "Nama MK",
  "Kode CPMK",
  "Kode Sub-CPMK",
  "Rumusan",
  "Level Bloom",
  "Tingkat KKNI",
  "sks Teori",
  "sks Praktik",
];

describe("pengenal Excel tidak ikut diterjemahkan", () => {
  it("tidak satu pun pengenal muncul sebagai nilai di sub-tabel excel", () => {
    // Cakupannya SENGAJA hanya `excel.*` — tabel label berkas yang dibaca
    // ulang. Judul bagian DOCX boleh saja kebetulan berbunyi "Sub-CPMK", dan
    // label LKPS boleh berbunyi "Mata Kuliah": keduanya tidak pernah diimpor,
    // jadi menerjemahkannya justru benar. Yang berbahaya hanya pengenal yang
    // sampai ke berkas nilai atau templat kurikulum.
    const nilaiEn = new Set(
      semuaLabel((labelDokumenEn as LabelDokumen).excel).map(([, v]) => v),
    );
    for (const p of PENGENAL) {
      assert.ok(
        !nilaiEn.has(p),
        `"${p}" adalah pengenal berkas impor, tetapi ada di tabel label — ` +
          `terjemahannya akan membuat berkas tidak dapat diunggah kembali`,
      );
    }
  });

  it("pengenal masih tertulis harfiah di kode pembacanya", () => {
    // Penjaga arah sebaliknya: bila suatu saat pengenal dipindah ke tabel
    // label, uji di atas belum tentu menangkapnya — nilainya bisa kebetulan
    // masih Indonesia. Yang ini menuntut pembacanya tetap memegang literal.
    const nilai = readFileSync("src/lib/evaluasi/excel-nilai.ts", "utf8");
    assert.match(nilai, /const KOLOM_NIM = "NIM";/);
    assert.match(nilai, /const KOLOM_NAMA = "Nama";/);
    assert.match(nilai, /export const LEMBAR_NILAI = "Nilai";/);

    const kurikulum = readFileSync("src/lib/kurikulum/excel.ts", "utf8");
    assert.match(kurikulum, /profilLulusan: "Profil Lulusan"/);
    assert.match(kurikulum, /mk: \["Kode MK", "Nama MK"/);
  });
});
