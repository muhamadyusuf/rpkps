/**
 * Pemilih kamus dan tipe bahasa.
 *
 * Sengaja TIDAK memakai `import()` dinamis seperti contoh dokumentasi Next:
 * kamus di sini dilewatkan utuh sebagai prop ke `PenyediaBahasa` di sisi
 * klien, jadi keduanya memang harus ada dalam berkas yang sama-sama dapat
 * dianalisis pemaket. Ukurannya kecil karena isinya string, bukan kode.
 */

import { en } from "./en";
import { id, type Kamus } from "./id";

export type { Kamus };

/**
 * Bahasa yang didukung. Urutannya bermakna: yang pertama adalah bawaan, dan
 * `generateStaticParams` menerbitkan halaman mengikuti urutan ini.
 */
export const BAHASA = ["id", "en"] as const;

export type Bahasa = (typeof BAHASA)[number];

/**
 * Bahasa asal isi RPKPS: versi otoritatif yang ditandatangani.
 *
 * Terpisah dari `BAHASA_BAWAAN` — yang itu soal antarmuka mana yang muncul
 * bila pengguna belum memilih. Yang ini soal teks mana yang berlaku bila
 * terjemahannya belum ada, dan jawabannya tidak boleh ikut berubah kalau suatu
 * saat bahasa bawaan antarmuka diganti.
 */
export const BAHASA_ASAL = "id" as const satisfies Bahasa;

export const BAHASA_BAWAAN: Bahasa = "id";

/** Nama cookie preferensi bahasa. Dibaca proxy — tidak boleh berubah diam-diam. */
export const NAMA_COOKIE_BAHASA = "bahasa";

/** Locale BCP-47 untuk `Intl`. Bukan nilai ruas alamat; jangan tertukar. */
export const LOCALE: Record<Bahasa, string> = {
  id: "id-ID",
  en: "en-US",
};

export function adalahBahasa(nilai: unknown): nilai is Bahasa {
  return typeof nilai === "string" && (BAHASA as readonly string[]).includes(nilai);
}

const KAMUS: Record<Bahasa, Kamus> = { id, en };

export function kamusUntuk(bahasa: Bahasa): Kamus {
  return KAMUS[bahasa];
}
