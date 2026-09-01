import type { MetadataRoute } from "next";
import { BAHASA, BAHASA_BAWAAN } from "@/kamus";
import { daftarProdiPublik, semuaAlamatPublik } from "@/lib/publik/muat";
import { jalurRpkpsPublik, urlSitus } from "@/lib/publik/tautan";

/**
 * Peta situs dibangun saat diminta, bukan saat build — sama alasannya dengan
 * halaman publik: `next build` tidak boleh bergantung pada database.
 */
export const dynamic = "force-dynamic";

type Butir = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dasar = urlSitus();

  const [prodi, dokumen] = await Promise.all([
    daftarProdiPublik(),
    semuaAlamatPublik(),
  ]);

  /**
   * Satu halaman menjadi satu baris PER BAHASA, masing-masing menunjuk
   * pasangannya lewat `alternates.languages`.
   *
   * Tanpa awalan bahasa, setiap alamat di peta situs akan dijawab pengalihan
   * 307 oleh proxy — perayap memperlakukan itu sebagai alamat yang bukan
   * kanonik, dan sinyal peringkatnya terpencar. `x-default` menunjuk bahasa
   * Indonesia karena ini situs kampus Indonesia.
   */
  function perBahasa(
    href: string,
    sisa: Omit<Butir, "url" | "alternates">,
  ): MetadataRoute.Sitemap {
    const languages = Object.fromEntries([
      ...BAHASA.map((b) => [b, `${dasar}/${b}${href}`]),
      ["x-default", `${dasar}/${BAHASA_BAWAAN}${href}`],
    ]);

    return BAHASA.map((b) => ({
      url: `${dasar}/${b}${href}`,
      alternates: { languages },
      ...sisa,
    }));
  }

  return [
    ...perBahasa("", {
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    }),
    ...perBahasa("/katalog", {
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }),
    ...prodi.flatMap((p) =>
      perBahasa(`/katalog/${p.kode.toLowerCase()}`, {
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    ),
    ...dokumen.flatMap((d) =>
      perBahasa(jalurRpkpsPublik(d.prodi, d.kode), {
        lastModified: d.diubahPada,
        changeFrequency: "yearly",
        priority: 0.7,
      }),
    ),
  ];
}
