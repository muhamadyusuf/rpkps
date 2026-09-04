import "server-only";
import { prisma } from "@/lib/prisma";
import { muatRpkps } from "@/lib/rpkps/muat";
import { dokumenPublik, type DokumenPublik } from "@/domain/rpkps/publik";
import { bolehDibuka } from "@/domain/rpkps/berbagi";
import type { StatusRpkps } from "@/generated/prisma";

/**
 * Pintu KEDUA tanpa login — tautan pratinjau bertoken (docs/06 §4.2–4.3).
 *
 * Amandemen yang dinyatakan, bukan diselundupkan. `src/lib/publik/muat.ts`
 * melayani katalog: hanya `TERBIT`, hanya salinan beku, terindeks. Berkas ini
 * melayani pratinjau: hanya lewat token yang sah dan belum kedaluwarsa,
 * membaca data LANGSUNG, selalu bertanda draf, tidak pernah terindeks.
 *
 * **Berkas yang satu tidak boleh memanggil berkas yang lain.** Keduanya adalah
 * pintu tanpa login dengan aturan yang berbeda, dan satu pemanggilan silang
 * cukup untuk membuat aturan yang satu diam-diam berlaku bagi yang lain.
 * Penjaganya `src/lib/berbagi/pintu.test.ts`.
 */

export interface PratinjauBerbagi {
  /** Selalu bertanda draf, apa pun statusnya — ini bukan dokumen resmi. */
  status: StatusRpkps;
  catatan: string | null;
  kedaluwarsa: Date;
  mk: { kode: string; nama: string; namaEn: string | null };
  prodi: { kode: string; nama: string; namaEn: string | null };
  tahunAkademik: string;
  /**
   * Isi dokumen, lewat proyeksi yang sama dengan katalog publik. Bukan baris
   * Prisma mentah: apa pun yang tidak ditulis eksplisit di `proyeksiIsi` tidak
   * akan pernah sampai ke halaman ini — termasuk kolom yang ditambahkan nanti.
   */
  dokumen: DokumenPublik;
}

/**
 * Membuka sebuah tautan. `null` berarti pintunya tertutup — token tidak
 * dikenal, sudah dicabut, atau sudah kedaluwarsa — dan pemanggil menampilkan
 * satu halaman yang sama untuk ketiganya: memberi tahu bahwa sebuah token
 * "hanya kedaluwarsa" adalah memberi tahu bahwa token itu pernah ada.
 */
export async function muatPratinjau(token: string): Promise<PratinjauBerbagi | null> {
  if (token.length < 16) return null;

  const tautan = await prisma.tautanBerbagi.findUnique({
    where: { token },
    select: { id: true, rpkpsId: true, catatan: true, kedaluwarsa: true, dicabutPada: true },
  });
  if (!tautan || !bolehDibuka(tautan, new Date())) return null;

  const rpkps = await muatRpkps(tautan.rpkpsId);
  if (!rpkps) return null;

  /*
   * Pencatatan akses TIDAK ditunggu, dan kegagalannya tidak menutup pintu:
   * halaman yang gagal terbuka karena penghitungnya bermasalah adalah
   * pertukaran yang salah arah. Yang dicatat pun hanya jumlah dan waktu —
   * bukan siapa, karena pembacanya memang tidak punya akun.
   */
  void prisma.tautanBerbagi
    .update({
      where: { id: tautan.id },
      data: { jumlahAkses: { increment: 1 }, terakhirAkses: new Date() },
    })
    .catch((galat) => console.error("[berbagi] gagal mencatat akses:", galat));

  return {
    status: rpkps.status,
    catatan: tautan.catatan,
    kedaluwarsa: tautan.kedaluwarsa,
    mk: {
      kode: rpkps.mataKuliah.kode,
      nama: rpkps.mataKuliah.nama,
      namaEn: rpkps.mataKuliah.namaEn,
    },
    prodi: {
      kode: rpkps.mataKuliah.kurikulum.prodi.kode,
      nama: rpkps.mataKuliah.kurikulum.prodi.nama,
      namaEn: rpkps.mataKuliah.kurikulum.prodi.namaEn,
    },
    tahunAkademik: rpkps.tahunAkademik.kode,
    dokumen: dokumenPublik(rpkps),
  };
}
