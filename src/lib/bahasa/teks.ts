/**
 * Perakit kalimat dari kamus. Murni: tanpa React, tanpa Next, tanpa Prisma —
 * aman dipakai di server, di klien, dan di uji.
 */

import { BAHASA_ASAL, LOCALE, type Bahasa } from "@/kamus";

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

/** Sepotong teks isi RPKPS beserta keterangan apakah ia sudah diterjemahkan. */
export interface TeksTerpilih {
  teks: string;
  /**
   * `true` berarti yang tampil adalah teks Indonesia karena nilai Inggrisnya
   * kosong. Bukan galat — belum diterjemahkan adalah keadaan normal, dan
   * antarmuka menandainya halus, bukan merah (docs/11 §5.4).
   */
  asli: boolean;
}

/**
 * Memilih teks isi RPKPS menurut bahasa pembacanya, dengan cadangan ke bahasa
 * Indonesia.
 *
 * Arahnya hanya satu: bahasa Indonesia adalah versi otoritatif, jadi pembaca
 * Inggris melihat teks Indonesia bila terjemahannya belum ada, sedangkan
 * pembaca Indonesia TIDAK pernah melihat teks Inggris. Membalik arah itu akan
 * memunculkan kalimat Inggris di tengah dokumen resmi berbahasa Indonesia.
 *
 * Spasi kosong dihitung kosong: kolom `*En` yang berisi " " datang dari borang
 * yang disentuh lalu ditinggalkan, dan menampilkannya menghasilkan baris kosong
 * yang tampak seperti data hilang.
 */
export function pilihTeks(
  asal: string | null | undefined,
  terjemahan: string | null | undefined,
  bahasa: Bahasa,
): TeksTerpilih {
  const pokok = asal ?? "";
  if (bahasa === BAHASA_ASAL) return { teks: pokok, asli: true };
  const en = terjemahan?.trim() ?? "";
  return en.length > 0 ? { teks: en, asli: false } : { teks: pokok, asli: true };
}

/** Bentuk daftar dari `pilihTeks`. Daftar kosong dihitung belum diterjemahkan. */
export function pilihDaftar(
  asal: readonly string[] | null | undefined,
  terjemahan: readonly string[] | null | undefined,
  bahasa: Bahasa,
): { teks: string[]; asli: boolean } {
  const pokok = [...(asal ?? [])];
  if (bahasa === BAHASA_ASAL) return { teks: pokok, asli: true };
  const en = (terjemahan ?? []).filter((t) => t.trim().length > 0);
  return en.length > 0 ? { teks: [...en], asli: false } : { teks: pokok, asli: true };
}

/**
 * Nama mata kuliah menurut bahasa pembacanya.
 *
 * Bentuk `pilihTeks` yang paling sering dipakai — nama mata kuliah muncul di
 * hampir setiap daftar dan kepala halaman, dan menuliskan pasangan kolomnya
 * di ~20 tempat adalah undangan untuk suatu hari lupa `namaEn` pada salah
 * satunya. Nama Indonesia tetap yang sah; yang Inggris hanya tampilan
 * (docs/11 §5.4).
 *
 * `kode` sengaja tidak ikut: ia pengenal, bukan kalimat, dan bentuk
 * "TI214 — Nama" berbeda-beda di tiap halaman.
 */
export function namaMk(
  mk: { nama: string; namaEn?: string | null },
  bahasa: Bahasa,
): string {
  return pilihTeks(mk.nama, mk.namaEn, bahasa).teks;
}
