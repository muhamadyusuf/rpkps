import "server-only";
import { prisma } from "@/lib/prisma";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
import { PERAN_CALON_KOORDINATOR } from "@/domain/kurikulum/koordinator";
import type { StatusRpkps } from "@/generated/prisma";

/**
 * Pembacaan penugasan koordinator mata kuliah (docs/13).
 *
 * Dipisah dari aksinya karena dua pembaca yang sangat berbeda memerlukannya:
 * papan penugasan Kaprodi, dan `buatRpkps` yang hanya perlu tahu satu id.
 */

/**
 * Pemegang sebuah (mata kuliah, tahun akademik) — atau null bila belum
 * ditugaskan. Dipakai `buatRpkps` untuk menentukan koordinator RPKPS baru
 * alih-alih menjadikan pembuatnya koordinator secara membuta (docs/13 §2.3).
 *
 * Penugasan pada dosen yang sudah nonaktif diperlakukan seperti tidak ada:
 * baris lama tidak dihapus saat seorang dosen dinonaktifkan, dan menjadikannya
 * koordinator dokumen baru berarti melahirkan RPKPS yang tidak dapat disunting
 * siapa pun kecuali Kaprodi.
 */
export async function koordinatorTertugas(
  mataKuliahId: string,
  tahunAkademikId: string,
): Promise<string | null> {
  const baris = await prisma.koordinatorMk.findUnique({
    where: { mataKuliahId_tahunAkademikId: { mataKuliahId, tahunAkademikId } },
    select: { penggunaId: true, pengguna: { select: { status: true } } },
  });
  if (!baris || baris.pengguna.status !== "AKTIF") return null;
  return baris.penggunaId;
}

export type CalonDosen = { id: string; nama: string; prodi: string | null };

/**
 * Calon koordinator, TIDAK disaring per prodi.
 *
 * Alasannya sama dengan calon pengampu di docs/06 §3.2: MK wajib umum, MK
 * layanan, dan dosen tamu dari prodi tetangga itu nyata. Yang dibatasi cakupan
 * prodi adalah siapa yang MENETAPKAN, bukan siapa yang ditetapkan — kode
 * prodi tetap ikut ke label supaya pemilihan tidak kehilangan konteks.
 */
export async function daftarCalonKoordinator(): Promise<CalonDosen[]> {
  const baris = await prisma.pengguna.findMany({
    where: {
      status: "AKTIF",
      penugasan: { some: { peran: { in: [...PERAN_CALON_KOORDINATOR] } } },
    },
    orderBy: { nama: "asc" },
    select: {
      id: true,
      nama: true,
      gelarDepan: true,
      gelarBelakang: true,
      penugasan: { select: { prodi: { select: { kode: true } } } },
    },
  });

  return baris.map((c) => ({
    id: c.id,
    nama: namaLengkapPengampu(c),
    prodi:
      [...new Set(c.penugasan.map((p) => p.prodi?.kode).filter(Boolean))].join("/") || null,
  }));
}

export type BarisPenugasan = {
  mataKuliahId: string;
  kode: string;
  nama: string;
  /** Nama Inggris apa adanya; yang memilih bahasanya adalah tampilan. */
  namaEn: string | null;
  semester: number;
  sks: number;
  koordinator: { penggunaId: string; nama: string; nonaktif: boolean } | null;
  ditetapkanOleh: string | null;
  ditetapkanPada: Date | null;
  /** RPKPS untuk tahun akademik yang sedang dilihat, bila sudah ada. */
  rpkps: { id: string; status: StatusRpkps; koordinatorId: string | null } | null;
};

/**
 * Satu halaman papan penugasan.
 *
 * Disaring dan dihalamankan di DATABASE, termasuk saringan "belum ditetapkan":
 * memuat seluruh mata kuliah lalu membuang yang sudah terisi di JavaScript
 * berarti angka pada kepala halaman dan isi tabelnya dihitung dari dua sumber
 * yang bisa menyimpang.
 */
export async function muatPapanPenugasan(opsi: {
  kurikulumId: string;
  tahunAkademikId: string;
  kata: string;
  hanyaKosong: boolean;
  lewati: number;
  ambil: number;
}): Promise<BarisPenugasan[]> {
  const baris = await prisma.mataKuliah.findMany({
    where: saringPapan(opsi),
    orderBy: [{ semester: "asc" }, { kode: "asc" }],
    skip: opsi.lewati,
    take: opsi.ambil,
    select: {
      id: true,
      kode: true,
      nama: true,
      namaEn: true,
      semester: true,
      sksTeori: true,
      sksPraktik: true,
      koordinator: {
        where: { tahunAkademikId: opsi.tahunAkademikId },
        select: {
          penggunaId: true,
          dibuatPada: true,
          pengguna: {
            select: { nama: true, gelarDepan: true, gelarBelakang: true, status: true },
          },
          ditetapkanOleh: { select: { nama: true } },
        },
      },
      rpkps: {
        where: { tahunAkademikId: opsi.tahunAkademikId },
        select: {
          id: true,
          status: true,
          pengampu: {
            where: { peran: "KOORDINATOR" },
            select: { penggunaId: true },
          },
        },
      },
    },
  });

  return baris.map((m) => {
    const tugas = m.koordinator[0];
    const r = m.rpkps[0];
    return {
      mataKuliahId: m.id,
      kode: m.kode,
      nama: m.nama,
      namaEn: m.namaEn,
      semester: m.semester,
      sks: m.sksTeori + m.sksPraktik,
      koordinator: tugas
        ? {
            penggunaId: tugas.penggunaId,
            nama: namaLengkapPengampu(tugas.pengguna),
            nonaktif: tugas.pengguna.status !== "AKTIF",
          }
        : null,
      ditetapkanOleh: tugas?.ditetapkanOleh?.nama ?? null,
      ditetapkanPada: tugas?.dibuatPada ?? null,
      rpkps: r
        ? { id: r.id, status: r.status, koordinatorId: r.pengampu[0]?.penggunaId ?? null }
        : null,
    };
  });
}

export function saringPapan(opsi: {
  kurikulumId: string;
  tahunAkademikId: string;
  kata: string;
  hanyaKosong: boolean;
}) {
  return {
    kurikulumId: opsi.kurikulumId,
    ...(opsi.kata
      ? {
          OR: [
            { kode: { contains: opsi.kata, mode: "insensitive" as const } },
            { nama: { contains: opsi.kata, mode: "insensitive" as const } },
            { namaEn: { contains: opsi.kata, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(opsi.hanyaKosong
      ? { koordinator: { none: { tahunAkademikId: opsi.tahunAkademikId } } }
      : {}),
  };
}
