import type { MetadataRoute } from "next";
import { daftarProdiPublik, semuaAlamatPublik } from "@/lib/publik/muat";
import { jalurRpkpsPublik, urlSitus } from "@/lib/publik/tautan";

/**
 * Peta situs dibangun saat diminta, bukan saat build — sama alasannya dengan
 * halaman publik: `next build` tidak boleh bergantung pada database.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dasar = urlSitus();

  const [prodi, dokumen] = await Promise.all([
    daftarProdiPublik(),
    semuaAlamatPublik(),
  ]);

  return [
    {
      url: dasar,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${dasar}/katalog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...prodi.map((p) => ({
      url: `${dasar}/katalog/${p.kode.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...dokumen.map((d) => ({
      url: `${dasar}${jalurRpkpsPublik(d.prodi, d.kode)}`,
      lastModified: d.diubahPada,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
