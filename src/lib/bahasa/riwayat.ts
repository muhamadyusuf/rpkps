/**
 * Perakit kalimat riwayat RPKPS.
 *
 * Sama seperti notifikasi: yang tersimpan peristiwanya, kalimatnya dirakit
 * saat dibaca. Bedanya riwayat juga ikut membeku ke dalam `rpkps_snapshot`,
 * jadi cadangan bahasa Indonesia benar-benar dipakai — salinan beku yang
 * dibuat sebelum L3 tidak punya `data`, dan salinan itu TIDAK ditulis ulang:
 * menyentuh isi snapshot dokumen terbit adalah persis yang dilarang.
 */

import type { DataRiwayat } from "@/domain/rpkps/riwayat";
import type { Kamus } from "@/kamus";
import { isi } from "./teks";

/** Membaca kolom `data`. Bentuknya Json bebas, jadi diperiksa di sini. */
export function bacaDataRiwayat(nilai: unknown): DataRiwayat | null {
  if (typeof nilai !== "object" || nilai === null) return null;
  const d = nilai as Record<string, unknown>;
  if (typeof d.kunci !== "string") return null;
  const params =
    typeof d.params === "object" && d.params !== null
      ? (d.params as Record<string, string | number>)
      : {};
  return { kunci: d.kunci as DataRiwayat["kunci"], params };
}

/**
 * Kalimat sebuah baris riwayat.
 *
 * `cadangan` adalah `deskripsi` yang tersimpan — dipakai bila barisnya tidak
 * punya `data`, atau kuncinya tidak dikenali kamus.
 */
export function teksRiwayat(
  data: DataRiwayat | null,
  cadangan: string,
  kam: Kamus,
): string {
  if (!data) return cadangan;
  const pola = kam.riwayat[data.kunci];
  return pola ? isi(pola, data.params) : cadangan;
}
