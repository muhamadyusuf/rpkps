import "server-only";
import { prisma } from "@/lib/prisma";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import type { PenggunaSesi } from "@/lib/sesi";

/**
 * Wewenang atas sebuah buku ajar — docs/16 §5.2.
 *
 * Diturunkan dari wewenang atas RPKPS-nya, dengan DUA perbedaan yang keduanya
 * disengaja dan keduanya mudah "diperbaiki" keliru oleh orang berikutnya:
 *
 * 1. **`bolehSuntingIsi` tidak berlaku.** Isi RPKPS terkunci begitu diajukan,
 *    karena Kaprodi dan Penjaminan Mutu menandatangani isi tertentu. Buku ajar
 *    tidak ditandatangani siapa pun, dan justru paling banyak dikerjakan
 *    SESUDAH RPKPS terbit — saat kuliahnya benar-benar berjalan. Mengunci buku
 *    ajar dengan status RPKPS berarti mematikan fitur ini di sepanjang
 *    semester yang seharusnya menjadi masa pakainya.
 *
 * 2. **Yang boleh menulis hanya pengampu, bukan pengelola.** Untuk RPKPS,
 *    `boleh = pengampu || pengelola`; ADMIN/KAPRODI/GPM ikut menyunting karena
 *    dokumen itu milik prodi. Buku ajar punya PENULIS, dan namanya tercetak di
 *    halaman hak cipta serta didaftarkan ke Perpusnas. Memberi pengelola hak
 *    tulis berarti memberi mereka hak menulis buku atas nama orang lain.
 *    Membaca tetap terbuka seperti biasa.
 */

export type WenangBuku = {
  sesi: PenggunaSesi;
  /** Buku ada di basis data. */
  ada: boolean;
  rpkpsId: string | null;
  bolehLihat: boolean;
  bolehTulis: boolean;
};

const PILIH_RPKPS = {
  mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } },
  pengampu: { select: { penggunaId: true, peran: true } },
} as const;

function timbang(
  sesi: PenggunaSesi,
  rpkps: {
    mataKuliah: { kurikulum: { prodiId: string } };
    pengampu: { penggunaId: string; peran: "KOORDINATOR" | "ANGGOTA" }[];
  },
) {
  const w = wenangAtasRpkps(sesi, rpkps);
  return { bolehLihat: w.bolehLihat, bolehTulis: w.pengampu };
}

/** Wewenang atas buku yang sudah ada. */
export async function wenangBuku(bukuId: string): Promise<WenangBuku> {
  const sesi = await wajibAktif();
  const buku = await prisma.bukuAjar.findUnique({
    where: { id: bukuId },
    select: { rpkpsId: true, rpkps: { select: PILIH_RPKPS } },
  });

  if (!buku) {
    return { sesi, ada: false, rpkpsId: null, bolehLihat: false, bolehTulis: false };
  }

  return { sesi, ada: true, rpkpsId: buku.rpkpsId, ...timbang(sesi, buku.rpkps) };
}

/** Wewenang MEMBUAT buku ajar untuk sebuah RPKPS. */
export async function wenangBukuBaru(rpkpsId: string): Promise<WenangBuku> {
  const sesi = await wajibAktif();
  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: PILIH_RPKPS,
  });

  if (!rpkps) {
    return { sesi, ada: false, rpkpsId: null, bolehLihat: false, bolehTulis: false };
  }

  return { sesi, ada: true, rpkpsId, ...timbang(sesi, rpkps) };
}

/**
 * Penyaring daftar buku ajar: yang RPKPS-nya berada dalam cakupan prodi,
 * DITAMBAH yang pengguna ampu sendiri walau di luar cakupan itu — bentuk yang
 * sama dengan `saringDaftarRpkps`, diteruskan lewat relasi `rpkps`.
 */
export function saringDaftarBuku(sesi: PenggunaSesi, cakupan: string[] | null) {
  if (cakupan === null) return {};
  return {
    rpkps: {
      OR: [
        { mataKuliah: { kurikulum: { prodiId: { in: cakupan } } } },
        { pengampu: { some: { penggunaId: sesi.id } } },
      ],
    },
  };
}
