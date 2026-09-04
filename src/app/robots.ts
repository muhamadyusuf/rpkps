import type { MetadataRoute } from "next";
import { BAHASA } from "@/kamus";
import { urlSitus } from "@/lib/publik/tautan";

/**
 * Hanya katalog publik yang boleh diindeks.
 *
 * Sisanya sudah dijaga `proxy.ts` dan pemeriksaan peran di layout — daftar ini
 * bukan pengaman, melainkan penghemat: tanpa itu perayap menghabiskan jatah
 * perayapannya pada alamat yang selalu mengalihkan ke halaman masuk.
 */

/** Modul dalam aplikasi; ditulis tanpa bahasa lalu dilebarkan per bahasa. */
const TERTUTUP = [
  "/dashboard",
  "/rpkps",
  "/kurikulum",
  "/kebijakan",
  "/pengguna",
  "/master",
  "/notifikasi",
  "/pengaturan",
  "/usulan",
  "/evaluasi",
  "/masuk",
  "/setup",
  "/menunggu-verifikasi",
  /**
   * Tautan pratinjau (docs/06 §4.2). Berbeda dari yang lain di daftar ini, ia
   * TIDAK dijaga sesi — tokenlah penjaganya — sehingga baris ini benar-benar
   * pengaman, bukan penghemat jatah perayapan. Satu tautan yang terindeks
   * menjadikan draf itu publik selamanya, jauh setelah kedaluwarsanya lewat.
   * Halamannya sendiri tetap memasang `noindex` sendiri; keduanya perlu.
   */
  "/pratinjau",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: BAHASA.flatMap((b) => [`/${b}`, `/${b}/katalog`]),
      // "/api/" tetap tanpa bahasa: Route Handler tidak berada di bawah
      // ruas [bahasa]. Sisanya dilebarkan agar /id/rpkps dan /en/rpkps
      // sama-sama tertutup — menyebut "/rpkps" saja tidak lagi cocok
      // dengan alamat mana pun.
      disallow: ["/api/", ...BAHASA.flatMap((b) => TERTUTUP.map((j) => `/${b}${j}`))],
    },
    sitemap: `${urlSitus()}/sitemap.xml`,
  };
}
