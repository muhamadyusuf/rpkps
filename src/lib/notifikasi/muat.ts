import "server-only";
import { prisma } from "@/lib/prisma";
import { bacaData, type DataNotifikasi } from "@/lib/bahasa/notifikasi";

/** Berapa notifikasi terakhir yang ditampilkan tanpa membuka halamannya. */
export const BATAS_RINGKAS = 8;

export type BarisNotifikasi = {
  id: string;
  /** Peristiwanya; kalimatnya dirakit `teksNotifikasi` saat dirender. */
  data: DataNotifikasi | null;
  /** Cadangan bahasa Indonesia untuk baris yang ditulis sebelum L3. */
  judul: string;
  ringkasan: string;
  tautan: string | null;
  dibacaPada: Date | null;
  dibuatPada: Date;
};

export async function hitungBelumDibaca(penggunaId: string): Promise<number> {
  return prisma.notifikasi.count({ where: { penggunaId, dibacaPada: null } });
}

/** Berapa notifikasi yang dimiliki seorang pengguna, dibaca maupun belum. */
export async function hitungNotifikasi(penggunaId: string): Promise<number> {
  return prisma.notifikasi.count({ where: { penggunaId } });
}

export async function muatNotifikasi(
  penggunaId: string,
  batas = BATAS_RINGKAS,
  /**
   * Baris yang dilewati. Ada supaya halaman notifikasi dapat dihalamankan:
   * notifikasi menumpuk selamanya dan tidak pernah menyusut, jadi daftar
   * berbatas tanpa `lewati` berarti kabar lama yang tidak dapat dicapai dari
   * mana pun. Ringkasan di rel tetap memanggilnya tanpa argumen ini.
   */
  lewati = 0,
): Promise<BarisNotifikasi[]> {
  const baris = await prisma.notifikasi.findMany({
    where: { penggunaId },
    orderBy: [{ dibacaPada: { sort: "asc", nulls: "first" } }, { dibuatPada: "desc" }],
    skip: lewati,
    take: batas,
    select: {
      id: true,
      data: true,
      judul: true,
      ringkasan: true,
      tautan: true,
      dibacaPada: true,
      dibuatPada: true,
    },
  });

  return baris.map((b) => ({ ...b, data: bacaData(b.data) }));
}
