import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Penyajian lambang lembaga. Acuan: docs/21 §2.2.
 *
 * ## Pintu ketiga tanpa login, dan itu disengaja
 *
 * docs/06 §4.3 menetapkan dua pintu tanpa login yang tertutup rapat pada
 * berkasnya masing-masing: `lib/publik/muat.ts` (katalog, hanya salinan beku
 * berstatus TERBIT) dan `lib/berbagi/muat.ts` (pratinjau bertoken). Berkas ini
 * tidak menjadi pintu ketiga ke salah satu dari keduanya — **ia tidak boleh
 * memanggil satu pun dari kedua berkas itu, dan keduanya tidak memanggilnya.**
 *
 * Yang dilayaninya hanya bita lambang: tidak ada isi dokumen, tidak ada kelas,
 * nilai, maupun evaluasi di baliknya, dan lambang prodi memang sudah terpampang
 * di gerbang kampus. Penjaganya `logo.test.ts`.
 *
 * Yang TIDAK dilayani di sini adalah penulisannya: unggahan lewat aksi server
 * yang menimbang wewenang (`bolehSuntingIdentitasProdi`) dan memeriksa bitanya
 * (`periksaLogo`).
 */

export interface BitaLogo {
  bita: Uint8Array;
  tipe: string;
  /** Cap ubah baris induknya — dasar `ETag` dan penanda versi pada `<img>`. */
  diubahPada: Date;
}

export async function logoProdi(prodiId: string): Promise<BitaLogo | null> {
  const baris = await prisma.prodi.findUnique({
    where: { id: prodiId },
    select: { logo: true, logoTipe: true, diubahPada: true },
  });
  return bentuk(baris);
}

export async function logoInstitusi(): Promise<BitaLogo | null> {
  const baris = await prisma.institusi.findFirst({
    select: { logo: true, logoTipe: true, diubahPada: true },
  });
  return bentuk(baris);
}

function bentuk(
  baris: { logo: Uint8Array | null; logoTipe: string | null; diubahPada: Date } | null,
): BitaLogo | null {
  if (!baris?.logo || !baris.logoTipe) return null;
  return { bita: baris.logo, tipe: baris.logoTipe, diubahPada: baris.diubahPada };
}

/**
 * Tanggapan HTTP sebuah lambang.
 *
 * `nosniff` bukan formalitas: hanya PNG dan JPEG yang pernah tersimpan
 * (`periksaLogo` menolak sisanya sebelum satu bita pun masuk basis data),
 * tetapi berkas yang disajikan dari asal-usul kita sendiri dieksekusi di
 * dalam asal-usul kita bila peramban salah menebak jenisnya — alasan yang
 * sama membuat rute gambar bab tidak pernah menyajikan SVG (docs/17 §5.2).
 */
export function tanggapanLogo(logo: BitaLogo): Response {
  return new Response(new Uint8Array(logo.bita), {
    headers: {
      "Content-Type": logo.tipe,
      // Publik: lambang lembaga bukan data pribadi, dan halaman katalog tanpa
      // login memuatnya. Alamatnya membawa `?v=<cap ubah>`, jadi penggantian
      // logo langsung terlihat meski umurnya panjang.
      "Cache-Control": "public, max-age=300, s-maxage=86400",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      ETag: `"${logo.diubahPada.getTime()}"`,
    },
  });
}
