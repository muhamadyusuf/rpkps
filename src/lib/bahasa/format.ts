import type { Kamus } from "@/kamus";
/**
 * Tanggal dan angka menurut bahasa aktif.
 *
 * Menggantikan `toLocaleDateString("id-ID", …)` yang tersebar di belasan
 * berkas. Selain soal bahasa, ini juga menyeragamkan bentuk: sebelumnya
 * tanggal yang sama muncul sebagai "5 Sep 2026" di satu halaman dan
 * "05 Sep 2026" di halaman sebelahnya.
 *
 * Murni — menerima bahasa sebagai parameter, tidak membacanya sendiri.
 */

import { LOCALE, type Bahasa } from "@/kamus";

const BENTUK: Record<string, Intl.DateTimeFormatOptions> = {
  /** 5 Sep 2026 */
  pendek: { day: "numeric", month: "short", year: "numeric" },
  /** 5 September 2026 */
  panjang: { day: "numeric", month: "long", year: "numeric" },
  /** 5 Sep 2026 14.30 */
  waktu: {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  /** 05/09/2026 — untuk kolom tabel sempit dan dokumen cetak */
  angka: { day: "2-digit", month: "2-digit", year: "numeric" },
};

export type BentukTanggal = keyof typeof BENTUK;

export function tanggal(
  nilai: Date | string | number,
  bahasa: Bahasa,
  bentuk: BentukTanggal = "pendek",
): string {
  return new Intl.DateTimeFormat(LOCALE[bahasa], BENTUK[bentuk]).format(
    nilai instanceof Date ? nilai : new Date(nilai),
  );
}

/**
 * Angka dengan pemisah desimal yang benar per bahasa — `85,5` vs `85.5`.
 * Bobot penilaian tercetak pada dokumen resmi, jadi perbedaan ini terlihat.
 */
export function angka(nilai: number, bahasa: Bahasa, desimalMaks = 2): string {
  return new Intl.NumberFormat(LOCALE[bahasa], {
    maximumFractionDigits: desimalMaks,
  }).format(nilai);
}

/** Persen apa adanya: nilai 85.5 → "85,5%" / "85.5%". Bukan pembagian 100. */
export function persen(nilai: number, bahasa: Bahasa, desimalMaks = 2): string {
  return `${angka(nilai, bahasa, desimalMaks)}%`;
}

/**
 * Durasi dalam kata: "2 jam 30 menit", "2 hours 30 minutes".
 *
 * Kembarannya `formatMenit` di `src/domain/beban-belajar/kalkulator.ts` tetap
 * ada untuk hitungan internal dan uji domain; yang tampil di layar selalu
 * lewat sini, karena hanya di sini ada kamusnya.
 */
export function durasi(menit: number, kam: Kamus): string {
  const negatif = menit < 0;
  const abs = Math.abs(Math.round(menit));
  const jam = Math.floor(abs / 60);
  const sisa = abs % 60;
  const bagian: string[] = [];
  if (jam > 0) bagian.push(`${jam} ${kam.umum.jam}`);
  if (sisa > 0 || jam === 0) bagian.push(`${sisa} ${kam.umum.menit}`);
  return (negatif ? "-" : "") + bagian.join(" ");
}
