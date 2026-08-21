import "server-only";
import { prisma } from "@/lib/prisma";
import { cairkanSnapshot, type IsiSnapshot } from "@/domain/rpkps/sidik";
import { sidikDokumen, type SumberProyeksi } from "@/domain/rpkps/proyeksi";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Membekukan RPKPS saat diterbitkan, dan membandingkan salinan beku itu
 * dengan data langsung untuk mendeteksi pergeseran isi.
 */

export function sidikRpkps(r: RpkpsLengkap): string {
  return sidikDokumen(r as unknown as SumberProyeksi);
}

export async function bekukanRpkps(
  rpkps: RpkpsLengkap,
  olehId: string,
): Promise<{ sidik: string; versi: number }> {
  const riwayat = await prisma.rpkpsRiwayat.findMany({
    where: { rpkpsId: rpkps.id },
    orderBy: { dibuatPada: "asc" },
    select: { versi: true, dibuatPada: true, deskripsi: true },
  });

  const isi: IsiSnapshot = {
    dokumen: JSON.parse(JSON.stringify(rpkps)),
    riwayat: riwayat.map((h) => ({
      versi: h.versi,
      dibuatPada: h.dibuatPada.toISOString(),
      deskripsi: h.deskripsi,
    })),
  };

  const sidik = sidikRpkps(rpkps);

  await prisma.rpkpsSnapshot.upsert({
    where: { rpkpsId_versi: { rpkpsId: rpkps.id, versi: rpkps.versi } },
    update: { isi: isi as never, sidik, olehId },
    create: { rpkpsId: rpkps.id, versi: rpkps.versi, isi: isi as never, sidik, olehId },
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
