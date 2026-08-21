/**
 * Tautan keluar ke situs resmi tiap program studi.
 *
 * Sengaja konstanta, bukan kolom baru di tabel `prodi`: daftarnya pendek,
 * jarang berubah, dan menambah kolom berarti migrasi plus formulir admin untuk
 * satu URL. Kunci memakai `Prodi.kode`.
 */
export const SITUS_PRODI: Readonly<Record<string, string>> = {
  TI: "https://ti.itts.ac.id",
};

export function situsProdi(kode: string): string | null {
  return SITUS_PRODI[kode.toUpperCase()] ?? null;
}

/**
 * Alamat kanonik situs, dipakai untuk `metadataBase`, sitemap, dan kartu
 * OpenGraph. Ketiganya butuh URL ABSOLUT — tanpa ini, pratinjau tautan di
 * WhatsApp dan LinkedIn menunjuk ke localhost.
 */
export function urlSitus(): string {
  const nilai = process.env.NEXT_PUBLIC_URL_SITUS?.trim();
  if (!nilai) return "http://localhost:3000";
  return nilai.replace(/\/+$/, "");
}

/** Alamat publik satu RPKPS, relatif terhadap akar situs. */
export function jalurRpkpsPublik(prodiKode: string, mkKode: string): string {
  return `/katalog/${prodiKode.toLowerCase()}/${mkKode.toLowerCase()}`;
}
