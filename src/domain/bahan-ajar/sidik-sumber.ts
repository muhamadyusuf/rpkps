import { hitungSidik } from "@/domain/rpkps/sidik";
import type { PertemuanUntukBab } from "./tipe";

/**
 * Sidik rencana sebuah minggu — dasar penanda "bab ini disusun dari rencana
 * yang sudah berubah" (docs/16 §5.3).
 *
 * Yang masuk hitungan hanyalah apa yang benar-benar DIBACA model saat menulis
 * bab: topik, subtopik, indikator, dan kode Sub-CPMK. Nomor minggu dan id
 * baris SENGAJA di luar — menggeser sebuah baris ke minggu lain tidak mengubah
 * satu kalimat pun isi babnya, dan menandainya bergeser hanya akan mengajari
 * dosen mengabaikan penanda ini.
 *
 * Ini penanda, bukan gerbang. Bab yang bergeser tetap dapat dibaca, disunting,
 * dan dicetak; yang berubah hanya satu baris keterangan di layar.
 */
export function sidikSumberBab(p: {
  topik: string | null;
  subtopik: string[];
  indikator: string[];
  subCpmk: { kode: string }[];
}): string {
  return hitungSidik({
    topik: rapikan(p.topik ?? ""),
    subtopik: p.subtopik.map(rapikan).filter(Boolean),
    indikator: p.indikator.map(rapikan).filter(Boolean),
    // Diurutkan: urutan Sub-CPMK pada sebuah minggu bukan informasi yang
    // dibaca model, sehingga menukarnya tidak boleh menyalakan penanda.
    subCpmk: p.subCpmk.map((s) => s.kode).sort(),
  });
}

/**
 * Spasi ganda dan spasi di ujung bukan perubahan rencana. Tanpa perapian ini
 * satu penekanan spasi di penyunting mingguan menandai seluruh bab bergeser.
 */
function rapikan(teks: string): string {
  return teks.trim().replace(/\s+/g, " ");
}

/** Bergeser bila keduanya diketahui DAN berbeda. */
export function babBergeser(
  sidikSumber: string | null,
  sidikSekarang: string | null,
): boolean {
  if (!sidikSumber || !sidikSekarang) return false;
  return sidikSumber !== sidikSekarang;
}

/** Sidik langsung dari sebuah baris mingguan lengkap. */
export function sidikPertemuan(p: PertemuanUntukBab): string {
  return sidikSumberBab(p);
}
