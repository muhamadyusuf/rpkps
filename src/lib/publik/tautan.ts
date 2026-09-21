/**
 * Tautan yang dirakit untuk katalog publik.
 *
 * Situs resmi tiap program studi DULU konstanta di berkas ini
 * (`SITUS_PRODI`), dengan alasan "daftarnya pendek dan menambah kolom berarti
 * migrasi plus formulir admin untuk satu URL". Alasan itu gugur begitu ada
 * lima medan identitas lain yang membutuhkan formulir yang sama, jadi sejak
 * docs/21 alamatnya hidup di kolom `prodi.situs` dan konstantanya dihapus —
 * bukan dibiarkan berdampingan sebagai cadangan. Dua daftar yang tidak
 * sinkron lebih buruk daripada satu daftar.
 */

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
