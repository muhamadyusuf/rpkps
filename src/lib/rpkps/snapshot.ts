import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { cairkanSnapshot, type IsiSnapshot } from "@/domain/rpkps/sidik";
import { bacaDataRiwayat } from "@/lib/bahasa/riwayat";
import { sidikDokumen, type SumberProyeksi } from "@/domain/rpkps/proyeksi";
import { proyeksiIsiEn, sidikDokumenEn, type SumberProyeksiEn } from "@/domain/rpkps/proyeksi-en";
import { kelengkapanRpkps } from "@/lib/rpkps/terjemahan";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Membekukan RPKPS saat diterbitkan, dan membandingkan salinan beku itu
 * dengan data langsung untuk mendeteksi pergeseran isi.
 */

export function sidikRpkps(r: RpkpsLengkap): string {
  return sidikDokumen(r as unknown as SumberProyeksi);
}

/** Sidik ruang KEDUA. Tidak pernah dibandingkan dengan `sidikRpkps`. */
export function sidikRpkpsEn(r: RpkpsLengkap): string {
  return sidikDokumenEn(r as unknown as SumberProyeksiEn);
}

export async function bekukanRpkps(
  rpkps: RpkpsLengkap,
  olehId: string,
): Promise<{ sidik: string; versi: number }> {
  const riwayat = await prisma.rpkpsRiwayat.findMany({
    where: { rpkpsId: rpkps.id },
    orderBy: { dibuatPada: "asc" },
    select: { versi: true, dibuatPada: true, deskripsi: true, data: true },
  });

  const isi: IsiSnapshot = {
    dokumen: JSON.parse(JSON.stringify(rpkps)),
    riwayat: riwayat.map((h) => ({
      versi: h.versi,
      dibuatPada: h.dibuatPada.toISOString(),
      // Keduanya ikut membeku: `data` supaya halaman publik dapat merakit
      // kalimatnya dalam bahasa pembaca, `deskripsi` supaya salinan beku tetap
      // terbaca sendiri. Snapshot lama tidak punya `data` dan TIDAK ditulis
      // ulang — menyentuh isi dokumen terbit adalah persis yang dilarang.
      deskripsi: h.deskripsi,
      data: bacaDataRiwayat(h.data),
    })),
  };

  const sidik = sidikRpkps(rpkps);

  /**
   * Versi Inggris dibekukan hanya bila ADA yang diterjemahkan.
   *
   * Nol terjemahan berarti tidak ada dokumen berbahasa Inggris — dan menulis
   * `isiEn` yang seluruh isinya cadangan bahasa Indonesia akan membuat halaman
   * `/en/katalog` menyatakan "versi Inggris terbit" atas dokumen yang satu
   * katanya pun tidak berbahasa Inggris.
   *
   * Sebaliknya, terjemahan yang belum lengkap TETAP dibekukan: `proyeksiIsiEn`
   * mencadangkan per medan, jadi hasilnya dokumen sebagian besar Inggris dengan
   * beberapa baris Indonesia — dan halaman publiknya menerangkan itu sekali di
   * kepala dokumen. Menahan seluruh dokumen sampai medan terakhir selesai
   * adalah cara tercepat membuat terjemahan tidak pernah terbit.
   */
  const adaTerjemahan = kelengkapanRpkps(rpkps).terisi > 0;
  // `Prisma.DbNull` dan bukan `null`: pada kolom Json, `null` biasa berarti
  // "JSON null tersimpan", bukan "kolom kosong".
  const isiEn = adaTerjemahan
    ? (proyeksiIsiEn(rpkps as unknown as SumberProyeksiEn) as never)
    : Prisma.DbNull;
  const sidikEn = adaTerjemahan ? sidikRpkpsEn(rpkps) : null;

  await prisma.rpkpsSnapshot.upsert({
    where: { rpkpsId_versi: { rpkpsId: rpkps.id, versi: rpkps.versi } },
    update: { isi: isi as never, sidik, isiEn, sidikEn, olehId },
    create: {
      rpkpsId: rpkps.id,
      versi: rpkps.versi,
      isi: isi as never,
      sidik,
      isiEn,
      sidikEn,
      olehId,
    },
  });

  return { sidik, versi: rpkps.versi };
}

export async function ambilSnapshot(rpkpsId: string, versi: number) {
  return prisma.rpkpsSnapshot.findUnique({
    where: { rpkpsId_versi: { rpkpsId, versi } },
  });
}

export { cairkanSnapshot };
export type { IsiSnapshot };

export type StatusPergeseran =
  | { ada: false }
  | { ada: true; sidikTerbit: string; sidikSekarang: string };

/**
 * Membandingkan isi dokumen sekarang dengan salinan yang disahkan.
 * Berbeda berarti ada yang berubah setelah pengesahan — paling sering
 * karena kurikulum disunting, bukan karena RPKPS-nya disentuh.
 */
export async function periksaPergeseran(
  rpkps: RpkpsLengkap,
): Promise<StatusPergeseran> {
  const snapshot = await ambilSnapshot(rpkps.id, rpkps.versi);
  if (!snapshot) return { ada: false };

  const sekarang = sidikRpkps(rpkps);
  if (sekarang === snapshot.sidik) return { ada: false };

  return { ada: true, sidikTerbit: snapshot.sidik, sidikSekarang: sekarang };
}
