/**
 * Alamat berawalan bahasa.
 *
 * Setiap alamat aplikasi berawalan bahasa — `/id/rpkps`, `/en/rpkps` — tanpa
 * kecuali. Bahasa Indonesia pun berawalan. Kalau bahasa bawaan dibiarkan
 * telanjang, setiap tautan punya dua bentuk yang sama-sama sah dan setiap
 * penyusun alamat harus tahu mana yang bawaan; itu percabangan yang akan
 * dilupakan seseorang, di suatu tempat, pada tahun ketiga.
 * Lihat docs/11-dwibahasa.md §2.1.
 *
 * Murni dan bebas Next — dipakai proxy (runtime Edge), Server Component,
 * maupun Client Component.
 */

import { BAHASA, adalahBahasa, type Bahasa } from "@/kamus";

/**
 * Alamat yang TIDAK pernah diberi awalan bahasa: berkas di akar dan seluruh
 * API. `src/app/api` tetap di luar `[bahasa]` karena Route Handler tidak
 * dapat membaca root params — bahasanya datang dari kueri `?bahasa=`.
 */
const TANPA_AWALAN = ["/api", "/_next", "/sitemap.xml", "/robots.txt", "/favicon.ico"];

export function tanpaAwalanBahasa(pathname: string): boolean {
  return TANPA_AWALAN.some((j) => pathname === j || pathname.startsWith(`${j}/`));
}

/** Bahasa pada awalan sebuah alamat, atau null bila tidak ada. */
export function bahasaPadaJalur(pathname: string): Bahasa | null {
  const ruas = pathname.split("/")[1];
  return adalahBahasa(ruas) ? ruas : null;
}

/**
 * Membuang awalan bahasa. `/en/rpkps/abc` → `/rpkps/abc`, dan `/en` → `/`.
 * Dipakai pengalih bahasa untuk berpindah tanpa meninggalkan halaman.
 */
export function lepasAwalan(pathname: string): string {
  const bahasa = bahasaPadaJalur(pathname);
  if (!bahasa) return pathname;
  const sisa = pathname.slice(bahasa.length + 1);
  return sisa === "" ? "/" : sisa;
}

/**
 * Alamat internal berawalan bahasa.
 *
 * `href` selalu ditulis TANPA bahasa (`/rpkps/abc`) di seluruh kode; fungsi
 * inilah satu-satunya tempat awalan dipasang. Alamat luar (http…, mailto:,
 * #jangkar) dilewatkan apa adanya.
 */
export function jalur(href: string, bahasa: Bahasa): string {
  if (!href.startsWith("/")) return href; // http(s), mailto, tel, #jangkar
  if (tanpaAwalanBahasa(href)) return href;
  if (bahasaPadaJalur(href)) return href; // sudah berawalan; jangan berlapis
  return href === "/" ? `/${bahasa}` : `/${bahasa}${href}`;
}

/** Seluruh bentuk berbahasa dari satu alamat. Dipakai `segarkan()`. */
export function segalaBahasa(href: string): string[] {
  return BAHASA.map((b) => jalur(href, b));
}
