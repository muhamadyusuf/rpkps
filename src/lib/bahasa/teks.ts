/**
 * Perakit kalimat dari kamus. Murni: tanpa React, tanpa Next, tanpa Prisma —
 * aman dipakai di server, di klien, dan di uji.
 */

import { LOCALE, type Bahasa } from "@/kamus";

export type Sisipan = Record<string, string | number>;

/**
 * Mengganti penanda `{nama}` pada pola kamus dengan nilainya.
 *
 * Penanda yang tidak punya pasangan sengaja DIBIARKAN apa adanya, bukan
 * diganti string kosong: "{jumlah} belum dibaca" yang bocor ke layar segera
 * terlihat dan segera diperbaiki, sedangkan " belum dibaca" tampak seperti
 * kalimat yang memang begitu dan bertahan berbulan-bulan.
 */
export function isi(pola: string, sisipan: Sisipan = {}): string {
  return pola.replace(/\{(\w+)\}/g, (utuh, nama: string) =>
    nama in sisipan ? String(sisipan[nama]) : utuh,
  );
}

/** Bentuk jamak sebuah kunci kamus. */
export interface PolaJamak {
  satu: string;
  banyak: string;
}

/**
 * Memilih bentuk tunggal atau jamak menurut kaidah bahasanya.
 *
 * Bahasa Indonesia tidak mengenal infleksi jamak sehingga kedua polanya sama
 * persis. Itu bukan pemborosan: biayanya satu baris di `id.ts`, imbalannya
 * `en.ts` dapat menulis "1 meeting" dan "12 meetings" tanpa satu pun
 * percabangan di pemanggil.
 */
export function jamak(
  pola: PolaJamak,
  jumlah: number,
  bahasa: Bahasa,
  sisipan: Sisipan = {},
): string {
  const bentuk = new Intl.PluralRules(LOCALE[bahasa]).select(jumlah);
  return isi(bentuk === "one" ? pola.satu : pola.banyak, { n: jumlah, ...sisipan });
}
