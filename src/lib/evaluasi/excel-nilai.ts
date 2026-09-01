import ExcelJS from "exceljs";
import type { Bahasa } from "@/kamus";
import { isi } from "@/lib/bahasa/teks";
import { labelDokumen, type LabelDokumen } from "@/lib/dokumen/label";
import type { BarisButirMentah, BarisMentah } from "@/domain/evaluasi/nilai";
import type { Asesmen } from "@/domain/evaluasi/peta-asesmen";

/**
 * Templat dan pembacaan berkas nilai per kelas — doc 05 §5.1, tahap E2.
 *
 * Judul kolom adalah KODE asesmen dari peta asesmen, bukan nama bebas. Dengan
 * begitu berkas yang diunggah selalu dapat dicocokkan ke rencana yang disahkan
 * tanpa menebak, dan templatnya tidak perlu dijaga selaras dengan tangan:
 * ia dihasilkan ulang dari RPKPS setiap kali diunduh.
 *
 * Terpisah dari `src/domain` agar domain tetap murni. Modul ini sengaja TIDAK
 * memakai `server-only`: ia tidak menyentuh Prisma maupun sesi, hanya menyusun
 * dan membaca workbook — sama seperti `src/lib/dokumen/rpkps-docx.ts` — dan
 * dengan begitu bolak-baliknya dapat diuji langsung.
 */

export const LEMBAR_NILAI = "Nilai";
export const LEMBAR_PETUNJUK = "Petunjuk";

/** NIM, Nama, Angkatan menempati tiga kolom pertama. */
const KOLOM_ASESMEN_PERTAMA = 4;

const KOLOM_NIM = "NIM";
const KOLOM_NAMA = "Nama";
const KOLOM_ANGKATAN = "Angkatan";

export interface ButirTemplat {
  jenis: "UTS" | "UAS";
  butir: { nomor: number; subCpmkKode: string; skorMaks: number }[];
}

export interface PesertaTemplat {
  nim: string;
  nama: string;
  angkatan: number | null;
  /** Skor per butir ujian yang sudah tersimpan: `${jenis}|${nomor}` → skor. */
  skorButir?: Record<string, number>;
  /** Skor yang sudah tersimpan, agar unduhan berikutnya tidak mulai kosong. */
  skor: Record<string, number>;
}

export interface OpsiTemplatNilai {
  mk: { kode: string; nama: string };
  tahunAkademik: string;
  kelas: string;
  asesmen: readonly Asesmen[];
  peserta: readonly PesertaTemplat[];
  /**
   * Kisi-kisi ujian. Bila ada, templat mendapat satu lembar per ujian untuk
   * skor per butir — bahan analisis butir (E6). Opsional: capaian tetap
   * dihitung dari lembar Nilai saja.
   */
  ujian?: readonly ButirTemplat[];
}

/** Nama lembar skor per butir satu ujian. */
export function lembarButir(jenis: "UTS" | "UAS"): string {
  return `Butir ${jenis}`;
}

export async function buatTemplatNilai(
  opsi: OpsiTemplatNilai,
  bahasa: Bahasa = "id",
): Promise<Buffer> {
  const L = labelDokumen(bahasa);
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";
  wb.created = new Date();

  // ── Lembar petunjuk ─────────────────────────────────────────────────
  const petunjuk = wb.addWorksheet(LEMBAR_PETUNJUK);
  petunjuk.columns = [
    { header: L.excel.kode, key: "kode", width: 12 },
    { header: L.excel.asesmen, key: "nama", width: 40 },
    { header: L.excel.masukKomponen, key: "komponen", width: 22 },
    { header: L.excel.bobotPersen, key: "bobot", width: 12 },
    { header: L.excel.subDitagih, key: "sub", width: 40 },
  ];
  petunjuk.getRow(1).font = { bold: true };

  petunjuk.addRow({
    kode: "",
    nama: `${opsi.mk.kode} — ${opsi.mk.nama} · ${opsi.tahunAkademik} · kelas ${opsi.kelas}`,
  });
  petunjuk.addRow({});
  for (const a of opsi.asesmen) {
    petunjuk.addRow({
      kode: a.kode,
      nama: a.nama,
      komponen: a.komponen ?? "—",
      bobot: a.bobot,
      sub: a.subCpmk.map((s) => s.kode).join(", "),
    });
  }
  petunjuk.addRow({});
  petunjuk.addRow({
    nama: L.excel.isiSkor,
  });
  petunjuk.addRow({
    nama: L.excel.janganUbahJudul,
  });
  petunjuk.addRow({
    nama: L.excel.pengenalTetapIndonesia,
  });

  // ── Lembar nilai ────────────────────────────────────────────────────
  const ws = wb.addWorksheet(LEMBAR_NILAI);
  ws.columns = [
    { header: KOLOM_NIM, key: "nim", width: 16 },
    { header: KOLOM_NAMA, key: "nama", width: 32 },
    { header: KOLOM_ANGKATAN, key: "angkatan", width: 11 },
    ...opsi.asesmen.map((a) => ({ header: a.kode, key: a.kode, width: 10 })),
  ];

  const judul = ws.getRow(1);
  judul.font = { bold: true };
  judul.alignment = { horizontal: "center" };
  for (const [i, a] of opsi.asesmen.entries()) {
    // Keterangan disimpan sebagai catatan sel, bukan sebagai baris kedua:
    // baris kedua akan terbaca sebagai data oleh siapa pun yang membaca
    // berkas ini tanpa aturan khusus.
    judul.getCell(KOLOM_ASESMEN_PERTAMA + i).note =
      isi(L.excel.catatanAsesmen, {
        nama: a.nama,
        bobot: a.bobot,
        komponen: a.komponen ?? L.excel.tanpaKomponen,
      });
  }
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];

  for (const p of opsi.peserta) {
    const baris: Record<string, string | number> = { nim: p.nim, nama: p.nama };
    if (p.angkatan !== null) baris.angkatan = p.angkatan;
    for (const a of opsi.asesmen) {
      const nilai = p.skor[a.kode];
      if (nilai !== undefined) baris[a.kode] = nilai;
    }
    ws.addRow(baris);
  }

  for (let i = 0; i < opsi.asesmen.length; i += 1) {
    const kolom = ws.getColumn(KOLOM_ASESMEN_PERTAMA + i);
    kolom.alignment = { horizontal: "center" };
    kolom.numFmt = "0.##";
  }

  for (const u of opsi.ujian ?? []) {
    if (u.butir.length === 0) continue;
    lembarSkorButir(wb, u, opsi.peserta, L);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Satu lembar per ujian: NIM, Nama, lalu satu kolom per baris kisi-kisi.
 *
 * Judul kolomnya nomor butir apa adanya, dan skor maksimum ditaruh sebagai
 * catatan sel — pola yang sama dengan lembar Nilai, supaya pembacaannya tetap
 * satu aturan: baris pertama judul, sisanya data.
 */
function lembarSkorButir(
  wb: ExcelJS.Workbook,
  u: ButirTemplat,
  peserta: readonly PesertaTemplat[],
  L: LabelDokumen,
) {
  const ws = wb.addWorksheet(lembarButir(u.jenis));
  ws.columns = [
    { header: KOLOM_NIM, key: "nim", width: 16 },
    { header: KOLOM_NAMA, key: "nama", width: 32 },
    ...u.butir.map((b) => ({ header: String(b.nomor), key: `b${b.nomor}`, width: 8 })),
  ];

  const judul = ws.getRow(1);
  judul.font = { bold: true };
  judul.alignment = { horizontal: "center" };
  for (const [i, b] of u.butir.entries()) {
    judul.getCell(3 + i).note = isi(L.excel.catatanButir, {
      kode: b.subCpmkKode,
      skor: b.skorMaks,
    });
  }
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  for (const p of peserta) {
    const isi: Record<string, string | number> = { nim: p.nim, nama: p.nama };
    for (const b of u.butir) {
      const nilai = p.skorButir?.[`${u.jenis}|${b.nomor}`];
      if (nilai !== undefined) isi[`b${b.nomor}`] = nilai;
    }
    ws.addRow(isi);
  }

  for (let i = 0; i < u.butir.length; i += 1) {
    const kolom = ws.getColumn(3 + i);
    kolom.alignment = { horizontal: "center" };
    kolom.numFmt = "0.##";
  }
}

/**
 * Membaca lembar skor butir satu ujian. Lembar yang tidak ada menghasilkan
 * daftar kosong — analisis butir memang opsional.
 */
export async function bacaBerkasButir(
  data: ArrayBuffer,
  jenis: "UTS" | "UAS",
): Promise<BarisButirMentah[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const ws = wb.getWorksheet(lembarButir(jenis));
  if (!ws) return [];

  const judul = new Map<number, string>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const t = teks(sel.value);
    if (t !== "") judul.set(kolom, t);
  });

  let kolomNim = 0;
  for (const [kolom, t] of judul) {
    if (t.toUpperCase() === KOLOM_NIM.toUpperCase()) kolomNim = kolom;
  }
  if (kolomNim === 0) kolomNim = 1;

  const hasil: BarisButirMentah[] = [];
  ws.eachRow((baris, nomor) => {
    if (nomor === 1) return;
    const skor: Record<number, string> = {};
    for (const [kolom, t] of judul) {
      const nomorButir = Number(t);
      if (!Number.isInteger(nomorButir) || nomorButir <= 0) continue;
      skor[nomorButir] = teks(baris.getCell(kolom).value);
    }
    hasil.push({ nomor, nim: teks(baris.getCell(kolomNim).value), skor });
  });

  return hasil;
}

/**
 * Membaca berkas nilai menjadi baris mentah.
 *
 * Kolom dikenali lewat teks judulnya. Judul yang bukan NIM/Nama diperlakukan
 * sebagai kolom asesmen apa adanya — termasuk yang tidak dikenal, supaya
 * `bacaNilai` yang memutuskan dan melaporkannya, bukan pembaca berkas ini.
 */
export async function bacaBerkasNilai(data: ArrayBuffer): Promise<BarisMentah[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const ws = wb.getWorksheet(LEMBAR_NILAI) ?? wb.worksheets[0];
  if (!ws) return [];

  const judul = new Map<number, string>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const t = teks(sel.value);
    if (t !== "") judul.set(kolom, t);
  });

  let kolomNim = 0;
  let kolomNama = 0;
  let kolomAngkatan = 0;
  for (const [kolom, t] of judul) {
    const atas = t.toUpperCase();
    if (atas === KOLOM_NIM.toUpperCase()) kolomNim = kolom;
    else if (atas === KOLOM_NAMA.toUpperCase()) kolomNama = kolom;
    else if (atas === KOLOM_ANGKATAN.toUpperCase()) kolomAngkatan = kolom;
  }
  // Berkas yang judulnya terlanjur diubah tetap terbaca dengan urutan semula.
  if (kolomNim === 0) kolomNim = 1;
  if (kolomNama === 0) kolomNama = 2;

  const hasil: BarisMentah[] = [];
  ws.eachRow((baris, nomor) => {
    if (nomor === 1) return;
    const skor: Record<string, string> = {};
    for (const [kolom, t] of judul) {
      if (kolom === kolomNim || kolom === kolomNama || kolom === kolomAngkatan) continue;
      skor[t] = teks(baris.getCell(kolom).value);
    }
    hasil.push({
      nomor,
      nim: teks(baris.getCell(kolomNim).value),
      nama: teks(baris.getCell(kolomNama).value),
      angkatan: kolomAngkatan === 0 ? undefined : teks(baris.getCell(kolomAngkatan).value),
      skor,
    });
  });

  return hasil;
}

function teks(nilai: ExcelJS.CellValue): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "object") {
    if (nilai instanceof Date) return nilai.toISOString();
    if ("text" in nilai && typeof nilai.text === "string") return nilai.text.trim();
    if ("result" in nilai) return String(nilai.result ?? "").trim();
    if ("richText" in nilai && Array.isArray(nilai.richText)) {
      return nilai.richText.map((r) => r.text).join("").trim();
    }
  }
  return String(nilai).trim();
}
