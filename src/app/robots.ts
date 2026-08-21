import type { MetadataRoute } from "next";
import { urlSitus } from "@/lib/publik/tautan";

/**
 * Hanya katalog publik yang boleh diindeks.
 *
 * Sisanya sudah dijaga `proxy.ts` dan pemeriksaan peran di layout — daftar ini
 * bukan pengaman, melainkan penghemat: tanpa itu perayap menghabiskan jatah
 * perayapannya pada alamat yang selalu mengalihkan ke halaman masuk.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/katalog"],
      disallow: [
        "/api/",
        "/dashboard",
        "/rpkps",
        "/kurikulum",
        "/kebijakan",
        "/pengguna",
        "/master",
        "/masuk",
        "/setup",
        "/menunggu-verifikasi",
      ],
    },
    sitemap: `${urlSitus()}/sitemap.xml`,
  };
}
