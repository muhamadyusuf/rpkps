import "server-only";
import ExcelJS from "exceljs";
import type {
  BarisCpl,
  BarisCpmk,
  BarisMk,
  BarisSubCpmk,
  IsiBerkas,
} from "@/domain/kurikulum/berkas";

/**
 * Pembacaan dan pembuatan berkas Excel template kurikulum.
 * Terpisah dari src/domain agar domain tetap murni dan dapat diuji.
 */

export const LEMBAR = {
  petunjuk: "Petunjuk",
  cpl: "CPL",
  mk: "Mata Kuliah",
  cpmk: "CPMK",
  subCpmk: "Sub-CPMK",
} as const;

const KOLOM = {
  cpl: ["Kode CPL", "Deskripsi", "Tingkat KKNI"],
  mk: ["Kode MK", "Nama MK", "Semester", "sks Teori", "sks Praktik", "Status", "Kode CPL (pisah koma)"],
  cpmk: ["Kode MK", "Kode CPMK", "Rumusan", "Level Bloom", "Kode CPL (pisah koma)"],
  subCpmk: ["Kode MK", "Kode CPMK", "Kode Sub-CPMK", "Rumusan", "Level Bloom"],
};

function teks(nilai: ExcelJS.CellValue): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "object") {
    if ("text" in nilai && typeof nilai.text === "string") return nilai.text.trim();
    if ("result" in nilai) return String(nilai.result ?? "").trim();
    if ("richText" in nilai && Array.isArray(nilai.richText)) {
      return nilai.richText.map((r) => r.text).join("").trim();
    }
    if (nilai instanceof Date) return nilai.toISOString();
  }
  return String(nilai).trim();
}

/**
 * Membaca lembar menjadi daftar objek.
 *
 * Kolom ditemukan lewat TEKS judulnya, bukan posisinya. Berkas yang diunduh
 * sebelum sebuah kolom ditambahkan tetap terbaca benar — kolom yang tidak ada
 * menjadi string kosong, bukan menggeser arti kolom di sebelahnya. Bila baris
 * judul tidak dikenali sama sekali (mis. dihapus), pembacaan kembali memakai
 * urutan kolom seperti semula.
 */
function bacaLembar<T extends object>(
  wb: ExcelJS.Workbook,
  nama: string,
  kunci: readonly (keyof T & string)[],
  judulKolom: readonly string[],
): T[] {
  const ws = wb.getWorksheet(nama);
  if (!ws) return [];

  const posisiJudul = new Map<string, number>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const t = teks(sel.value).toLowerCase();
    if (t && !posisiJudul.has(t)) posisiJudul.set(t, kolom);
  });

  const kolom = kunci.map((_, i) => posisiJudul.get(judulKolom[i]?.toLowerCase() ?? "") ?? null);
  const judulDikenali = kolom.some((k) => k !== null);

  const hasil: T[] = [];
  ws.eachRow((row, nomor) => {
    if (nomor === 1) return; // baris judul
    const nilai = kunci.map((_, i) => {
      const k = judulDikenali ? kolom[i] : i + 1;
      return k === null ? "" : teks(row.getCell(k).value);
    });
    if (nilai.every((v) => v === "")) return; // baris kosong
    const obj = {} as Record<string, string>;
    kunci.forEach((k, i) => (obj[k] = nilai[i]));
    hasil.push(obj as T);
  });
  return hasil;
}

export async function bacaBerkasKurikulum(buffer: ArrayBuffer): Promise<IsiBerkas> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  return {
    cpl: bacaLembar<BarisCpl>(
      wb, LEMBAR.cpl, ["kode", "deskripsi", "tingkatKkni"], KOLOM.cpl,
    ),
    mk: bacaLembar<BarisMk>(
      wb, LEMBAR.mk,
      ["kode", "nama", "semester", "sksTeori", "sksPraktik", "status", "cplKode"],
      KOLOM.mk,
    ),
    cpmk: bacaLembar<BarisCpmk>(
      wb, LEMBAR.cpmk,
      ["mkKode", "kode", "rumusan", "levelBloom", "cplKode"],
      KOLOM.cpmk,
    ),
    subCpmk: bacaLembar<BarisSubCpmk>(
      wb, LEMBAR.subCpmk,
      ["mkKode", "cpmkKode", "kode", "rumusan", "levelBloom"],
      KOLOM.subCpmk,
    ),
  };
}

function siapkanLembar(
  wb: ExcelJS.Workbook,
  nama: string,
  kolom: string[],
  lebar: number[],
  contoh: string[][],
) {
  const ws = wb.addWorksheet(nama);
  ws.addRow(kolom);
  const judul = ws.getRow(1);
  judul.font = { bold: true, color: { argb: "FFFFFFFF" } };
  judul.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  judul.alignment = { vertical: "middle" };
  judul.height = 22;
  kolom.forEach((_, i) => (ws.getColumn(i + 1).width = lebar[i] ?? 20));

  for (const baris of contoh) {
    const r = ws.addRow(baris);
    r.font = { italic: true, color: { argb: "FF9CA3AF" } };
    r.alignment = { vertical: "top", wrapText: true };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

/** Template kosong berisi baris contoh (bergaya abu-abu, tinggal ditimpa). */
export async function buatTemplateKurikulum(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";
  wb.created = new Date();

  const petunjuk = wb.addWorksheet(LEMBAR.petunjuk);
  petunjuk.getColumn(1).width = 110;
  const baris: [string, boolean][] = [
    ["Template Impor Kurikulum — RPKPS ITTS", true],
    ["", false],
    ["Isi empat lembar berikut sesuai buku kurikulum program studi.", false],
    ["Baris contoh berwarna abu-abu boleh langsung ditimpa atau dihapus.", false],
    ["", false],
    ["1. CPL — Capaian Pembelajaran Lulusan program studi.", true],
    ["   Kode CPL harus unik, mis. CPL06.", false],
    ["", false],
    ["2. Mata Kuliah — daftar mata kuliah beserta beban sks.", true],
    ["   sks dipecah TEORI dan PRAKTIK. Totalnya sama, tetapi beban terjadwal", false],
    ["   berbeda jauh: 3 sks teori butuh 150 menit tatap muka, sedangkan", false],
    ["   2 teori + 1 praktik butuh 200 menit karena praktikum memakai slot lab.", false],
    ["   Kolom Kode CPL diisi kode CPL yang dibebankan, dipisah koma.", false],
    ["", false],
    ["3. CPMK — Capaian Pembelajaran Mata Kuliah.", true],
    ["   Setiap CPMK harus menjabarkan minimal satu CPL yang dibebankan pada", false],
    ["   mata kuliahnya. CPL yang dibebankan tetapi tidak dijabarkan CPMK mana pun", false],
    ["   akan ditolak — CPL seperti itu tidak akan pernah dinilai.", false],
    ["", false],
    ["4. Sub-CPMK — tahapan belajar, umumnya satu per pertemuan.", true],
    ["   Isi Kode MK DAN Kode CPMK induknya. Kode CPMK hanya unik di dalam satu", false],
    ["   mata kuliah, jadi \"CPMK01\" saja tidak menunjukkan induk yang mana bila", false],
    ["   dipakai beberapa mata kuliah sekaligus.", false],
    ["   Level Bloom Sub-CPMK tidak boleh melampaui CPMK induknya.", false],
    ["", false],
    ["Level Bloom yang dikenali:", true],
    ["   Kognitif   C1 Mengingat · C2 Memahami · C3 Menerapkan", false],
    ["              C4 Menganalisis · C5 Mengevaluasi · C6 Mencipta", false],
    ["   Afektif    A1–A5      Psikomotor  P1–P5", false],
    ["   Kolom ini boleh dikosongkan; sistem akan menebaknya dari kata kerja.", false],
    ["", false],
    ["Hindari kata yang tidak dapat diamati seperti \"memahami\" atau \"mengetahui\"", true],
    ["pada rumusan Sub-CPMK — keduanya tidak dapat dijadikan dasar penilaian.", false],
  ];
  for (const [teksBaris, tebal] of baris) {
    const r = petunjuk.addRow([teksBaris]);
    if (tebal) r.font = { bold: true };
  }

  siapkanLembar(wb, LEMBAR.cpl, KOLOM.cpl, [14, 90, 14], [
    ["CPL06", "Mampu menerapkan pemikiran logis, kritis, sistematis, dan inovatif dalam konteks pengembangan ilmu pengetahuan dan teknologi.", "6"],
    ["CPL08", "Mampu merancang, mengimplementasi, dan mengevaluasi solusi berbasis computing sesuai kebutuhan.", "6"],
  ]);

  siapkanLembar(wb, LEMBAR.mk, KOLOM.mk, [12, 34, 11, 11, 12, 12, 26], [
    ["TI214", "Basis Data", "2", "2", "1", "WAJIB", "CPL06, CPL08"],
  ]);

  siapkanLembar(wb, LEMBAR.cpmk, KOLOM.cpmk, [12, 14, 70, 14, 24], [
    ["TI214", "CPMK081", "Mampu mengidentifikasi kebutuhan pengguna dan merancang solusi berbasis computing yang optimal.", "C6", "CPL08"],
    ["TI214", "CPMK082", "Mampu mengimplementasikan sistem berbasis teknologi informasi menggunakan platform komputasi modern.", "C3", "CPL06"],
  ]);

  // Contoh sengaja dibuat LOLOS validasi: setiap CPMK punya Sub-CPMK, dan
  // level Sub-CPMK tidak melampaui induknya. Dosen melihat bentuk yang benar.
  siapkanLembar(wb, LEMBAR.subCpmk, KOLOM.subCpmk, [12, 14, 18, 76, 14], [
    ["TI214", "CPMK081", "CPMK081-1", "Mahasiswa mampu menjelaskan konsep dasar sistem basis data dan perbedaannya dengan sistem penyimpanan konvensional.", "C2"],
    ["TI214", "CPMK081", "CPMK081-2", "Mahasiswa mampu merancang model konseptual basis data menggunakan Entity Relationship Diagram.", "C6"],
    ["TI214", "CPMK082", "CPMK082-1", "Mahasiswa mampu menerapkan perintah DDL untuk membangun skema basis data relasional.", "C3"],
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
