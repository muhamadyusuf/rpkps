import { bahasa as ruasBahasa } from "next/root-params";
import { cookies } from "next/headers";
import {
  BAHASA_BAWAAN,
  NAMA_COOKIE_BAHASA,
  adalahBahasa,
  kamusUntuk,
  type Bahasa,
  type Kamus,
} from "@/kamus";
import { jalur } from "./jalur";

/**
 * Bahasa aktif menurut ALAMAT, dibaca lewat `next/root-params`.
 *
 * Ini sumber kebenaran untuk render. Sengaja tidak menyentuh cookie maupun
 * basis data: katalog publik dirender statis, dan membaca cookie di sana akan
 * menariknya menjadi dinamis — satu-satunya bagian aplikasi yang dibaca mesin
 * pencari justru kehilangan cache-nya.
 *
 * TIDAK dapat dipakai di Server Action, Route Handler, maupun Client
 * Component; itu batasan `next/root-params`, bukan pilihan kita.
 * Untuk Server Action pakai `bahasaAksi()`.
 */
export async function bahasaAktif(): Promise<Bahasa> {
  const ruas = await ruasBahasa();
  return adalahBahasa(ruas) ? ruas : BAHASA_BAWAAN;
}

/** Kamus untuk bahasa alamat saat ini. */
export async function kamus(): Promise<Kamus> {
  return kamusUntuk(await bahasaAktif());
}

/**
 * Bahasa di dalam Server Action, dibaca dari cookie.
 *
 * Aksi berjalan di luar pohon render sehingga tidak punya root params. Cookie
 * `bahasa` selalu terpasang oleh proxy sebelum permintaan pertama sampai ke
 * halaman, jadi nilainya ada — cadangan ke bahasa bawaan hanya untuk klien
 * yang menolak cookie.
 */
export async function bahasaAksi(): Promise<Bahasa> {
  const nilai = (await cookies()).get(NAMA_COOKIE_BAHASA)?.value;
  return adalahBahasa(nilai) ? nilai : BAHASA_BAWAAN;
}

/** Kamus di dalam Server Action. */
export async function kamusAksi(): Promise<Kamus> {
  return kamusUntuk(await bahasaAksi());
}

/**
 * Alamat internal berawalan bahasa, untuk dipakai bersama `redirect`:
 *
 * ```ts
 * if (!sesi) redirect(await jalurAktif("/masuk"));
 * ```
 *
 * Sengaja BUKAN pembungkus `redirect` sendiri. `redirect()` bertipe kembali
 * `never`, dan TypeScript memakai itu untuk mempersempit tipe di baris-baris
 * sesudahnya — `sesi` menjadi bukan-null tanpa tanda seru. Pembungkus
 * `async` merusak penyempitan itu karena yang terlihat kompilator adalah
 * `await`, bukan pemanggilan yang tak pernah kembali.
 *
 * Bahasa dibaca dari cookie, bukan root params, agar satu fungsi ini dapat
 * dipanggil dari Server Component maupun Server Action.
 */
export async function jalurAktif(href: string): Promise<string> {
  return jalur(href, await bahasaAksi());
}
