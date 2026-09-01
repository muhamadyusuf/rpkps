/**
 * Perakit kalimat notifikasi.
 *
 * Sebuah notifikasi ditulis sekali dan dibaca berbulan-bulan kemudian. Yang
 * disimpan adalah `kunci` dan `params`; kalimatnya dirakit di sini, dalam
 * bahasa PEMBACA — bukan bahasa orang yang kebetulan menekan tombolnya.
 *
 * Baris lama tidak punya `data`. Baris itu tidak ditulis ulang: ia hanya
 * kehilangan kemampuan berganti bahasa, dan `judul`/`ringkasan` yang tersimpan
 * dipakai apa adanya. Itu harga yang wajar untuk migrasi tanpa risiko
 * (docs/11 §4.2).
 */

import type { KunciNotifikasi } from "@/domain/notifikasi/pesan";
import type { Kamus } from "@/kamus";
import { isi } from "./teks";

export interface DataNotifikasi {
  kunci: KunciNotifikasi;
  params: Record<string, string>;
}

export interface TeksNotifikasi {
  judul: string;
  ringkasan: string;
}

/**
 * Membaca kolom `notifikasi.data`. Bentuknya Json bebas dari sisi Prisma, jadi
 * diperiksa di sini — baris yang ditulis versi lama, atau oleh kode yang belum
 * ada saat ini ditulis, harus jatuh ke cadangan alih-alih melempar.
 */
export function bacaData(nilai: unknown): DataNotifikasi | null {
  if (typeof nilai !== "object" || nilai === null) return null;
  const d = nilai as Record<string, unknown>;
  if (typeof d.kunci !== "string") return null;
  const params =
    typeof d.params === "object" && d.params !== null
      ? (d.params as Record<string, string>)
      : {};
  return { kunci: d.kunci as KunciNotifikasi, params };
}

/**
 * Kalimat sebuah notifikasi.
 *
 * `cadangan` adalah `judul`/`ringkasan` yang tersimpan di basis data — dipakai
 * bila barisnya tidak punya `data`, atau kuncinya tidak dikenali kamus.
 */
export function teksNotifikasi(
  data: DataNotifikasi | null,
  cadangan: TeksNotifikasi,
  kam: Kamus,
): TeksNotifikasi {
  if (!data) return cadangan;
  const pola = kam.pesanNotifikasi[data.kunci];
  if (!pola) return cadangan;

  // Kata keputusan adalah enum, bukan kalimat: kamus yang punya labelnya.
  const keputusan = data.params.keputusan;
  const sisipan = {
    ...data.params,
    ...(keputusan && keputusan in kam.keputusanUsulan
      ? { keputusan: kam.keputusanUsulan[keputusan as keyof Kamus["keputusanUsulan"]] }
      : {}),
  };

  return { judul: isi(pola.judul, sisipan), ringkasan: isi(pola.ringkasan, sisipan) };
}
