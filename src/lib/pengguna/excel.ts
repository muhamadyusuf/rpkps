import "server-only";
import ExcelJS from "exceljs";
import type { Bahasa } from "@/kamus";
import { labelDokumen } from "@/lib/dokumen/label";
import type { BarisPenggunaMentah } from "@/domain/pengguna/impor";

/**
 * Pembacaan dan pembuatan berkas Excel template impor pengguna.
 * Terpisah dari src/domain agar domain tetap murni dan dapat diuji.
 */

export const LEMBAR_PENGGUNA = {
  petunjuk: "Petunjuk",
  pengguna: "Pengguna",
} as const;

const KOLOM_PENGGUNA = ["Email", "Nama", "Peran", "Kode Prodi"] as const;

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

/** Membaca lembar "Pengguna". Kolom dicocokkan lewat teks judulnya (lihat kurikulum/excel.ts). */
export async function bacaBerkasPengguna(buffer: ArrayBuffer): Promise<BarisPenggunaMentah[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(LEMBAR_PENGGUNA.pengguna);
  if (!ws) return [];

  const posisiJudul = new Map<string, number>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const t = teks(sel.value).toLowerCase();
    if (t && !posisiJudul.has(t)) posisiJudul.set(t, kolom);
  });

  const kolom = KOLOM_PENGGUNA.map((j) => posisiJudul.get(j.toLowerCase()) ?? null);
  const judulDikenali = kolom.some((k) => k !== null);

  const hasil: BarisPenggunaMentah[] = [];
  ws.eachRow((row, nomor) => {
    if (nomor === 1) return; // baris judul
    const nilai = KOLOM_PENGGUNA.map((_, i) => {
      const k = judulDikenali ? kolom[i] : i + 1;
      return k === null ? "" : teks(row.getCell(k).value);
    });
    if (nilai.every((v) => v === "")) return; // baris kosong
    hasil.push({
      baris: nomor,
      email: nilai[0],
      nama: nilai[1],
      peran: nilai[2],
      prodiKode: nilai[3],
    });
  });
  return hasil;
}

function siapkanLembar(
  wb: ExcelJS.Workbook,
  nama: string,
  kolom: readonly string[],
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
export async function buatTemplatePengguna(bahasa: Bahasa = "id"): Promise<Buffer> {
  const L = labelDokumen(bahasa);
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";
  wb.created = new Date();

  const petunjuk = wb.addWorksheet(LEMBAR_PENGGUNA.petunjuk);
  petunjuk.getColumn(1).width = 110;
  const baris: [string, boolean][] = L.excel.templatPengguna.map((t) => [
    t,
    t.length > 0 && !t.startsWith(" "),
  ]);
  for (const [teksBaris, tebal] of baris) {
    const r = petunjuk.addRow([teksBaris]);
    if (tebal) r.font = { bold: true };
  }

  siapkanLembar(wb, LEMBAR_PENGGUNA.pengguna, KOLOM_PENGGUNA, [28, 24, 16, 14], [
    ["dosen.contoh@ittelkom-sby.ac.id", "Dr. Contoh Dosen, M.Kom.", "DOSEN", "TI"],
    ["kaprodi.contoh@ittelkom-sby.ac.id", "Contoh Kaprodi, S.Kom., M.T.", "KAPRODI", "TI"],
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
