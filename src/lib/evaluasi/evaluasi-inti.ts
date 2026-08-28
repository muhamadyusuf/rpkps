import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { CapaianButir } from "@/domain/evaluasi/capaian";
import type { BarisCapaian } from "@/domain/evaluasi/agregasi";
import type { IsiEvaluasi } from "@/domain/evaluasi/proyeksi";

/**
 * Lapisan basis data evaluasi ketercapaian — doc 05 tahap E3–E4.
 *
 * Klien Prisma diterima sebagai PARAMETER, mengikuti `usulan-inti.ts` dan
 * `nilai-inti.ts`: penutupan evaluasi menulis empat tabel sekaligus di dalam
 * satu transaksi, dan itu harus dapat diuji terhadap Postgres sungguhan.
 */

export type Klien = PrismaClient;

export const SERTAKAN_EVALUASI = {
  temuan: {
    orderBy: [{ tingkat: "asc" }, { kode: "asc" }],
    include: {
      penanggungJawab: { select: { id: true, nama: true } },
      taSasaran: { select: { id: true, kode: true } },
      usulan: { select: { id: true, judul: true, status: true } },
    },
  },
  hasil: { orderBy: [{ tingkat: "asc" }, { kode: "asc" }] },
  ditutupOleh: { select: { nama: true } },
} satisfies Prisma.EvaluasiMkInclude;

/**
 * Evaluasi dibuat saat pertama kali dibuka, bukan saat kelas dibuat.
 *
 * Alasannya: kelas yang belum punya nilai belum punya apa pun untuk
 * dievaluasi, dan baris kosong yang tak pernah disentuh hanya menambah
 * kebisingan pada laporan tingkat prodi nanti.
 */
export async function muatAtauBuatEvaluasi(
  klien: Klien,
  kelasId: string,
  ambang: { kelulusanMhs: number; ketercapaianMk: number },
) {
  const ada = await klien.evaluasiMk.findUnique({
    where: { kelasId },
    include: SERTAKAN_EVALUASI,
  });
  if (ada) return ada;

  await klien.evaluasiMk.create({
    data: {
      kelasId,
      ambangKelulusanMhs: ambang.kelulusanMhs,
      ambangKetercapaianMk: ambang.ketercapaianMk,
    },
  });

  return klien.evaluasiMk.findUniqueOrThrow({
    where: { kelasId },
    include: SERTAKAN_EVALUASI,
  });
}

export interface ArgTutup {
  evaluasiId: string;
  butir: readonly CapaianButir[];
  isi: IsiEvaluasi;
  sidik: string;
  ambang: { kelulusanMhs: number; ketercapaianMk: number };
  olehId: string;
}

/**
 * Menutup evaluasi: membekukan hasilnya, menyimpan capaian per butir, dan
 * menyalin ambang yang berlaku.
 *
 * Capaian disimpan DUA KALI dengan sengaja — sebagai baris `HasilCapaian`
 * yang dapat dikueri untuk agregasi prodi (E5), dan sebagai JSON di dalam
 * snapshot yang bersidik. Baris bisa dihitung ulang; snapshot tidak boleh.
 */
export async function tutupEvaluasi(klien: Klien, arg: ArgTutup) {
  return klien.$transaction(async (tx) => {
    const evaluasi = await tx.evaluasiMk.findUniqueOrThrow({
      where: { id: arg.evaluasiId },
      select: { versi: true, status: true },
    });
    if (evaluasi.status === "DITUTUP") {
      throw new Error("Evaluasi sudah ditutup.");
    }

    await tx.hasilCapaian.deleteMany({ where: { evaluasiId: arg.evaluasiId } });
    await tx.hasilCapaian.createMany({
      data: arg.butir.map((b) => ({
        evaluasiId: arg.evaluasiId,
        tingkat: b.tingkat,
        kode: b.kode,
        rerata: b.rerata,
        persenLulus: b.persenLulus,
        tercapai: b.tercapai,
        pita: b.pita,
        jumlahDinilai: b.jumlahDinilai,
      })),
    });

    await tx.evaluasiSnapshot.upsert({
      where: { evaluasiId_versi: { evaluasiId: arg.evaluasiId, versi: evaluasi.versi } },
      update: { isi: arg.isi as never, sidik: arg.sidik, olehId: arg.olehId },
      create: {
        evaluasiId: arg.evaluasiId,
        versi: evaluasi.versi,
        isi: arg.isi as never,
        sidik: arg.sidik,
        olehId: arg.olehId,
      },
    });

    return tx.evaluasiMk.update({
      where: { id: arg.evaluasiId },
      data: {
        status: "DITUTUP",
        ambangKelulusanMhs: arg.ambang.kelulusanMhs,
        ambangKetercapaianMk: arg.ambang.ketercapaianMk,
        ditutupOlehId: arg.olehId,
        ditutupPada: new Date(),
      },
      select: { id: true, versi: true, status: true },
    });
  });
}

/**
 * Membuka kembali evaluasi yang sudah ditutup — mis. setelah remedial atau
 * ralat entri.
 *
 * Versinya naik, dan salinan beku lama TIDAK disentuh: catatan yang pernah
 * disahkan tetap dapat dibaca ulang persis. Ini pola yang sama dengan versi
 * RPKPS, dan alasannya sama — laporan akreditasi harus dapat diulang.
 */
export async function bukaKembaliEvaluasi(klien: Klien, evaluasiId: string) {
  return klien.evaluasiMk.update({
    where: { id: evaluasiId },
    data: {
      status: "DIHITUNG",
      versi: { increment: 1 },
      ditutupOlehId: null,
      ditutupPada: null,
    },
    select: { id: true, versi: true },
  });
}

export type KelasLengkap = NonNullable<Awaited<ReturnType<typeof muatKelas>>>;

export async function muatKelas(klien: Klien, kelasId: string) {
  return klien.kelas.findUnique({
    where: { id: kelasId },
    include: {
      dosen: { select: { id: true, nama: true } },
      rpkps: {
        select: {
          id: true,
          status: true,
          tahunAkademik: { select: { kode: true } },
          mataKuliah: {
            select: {
              kode: true,
              nama: true,
              kurikulum: { select: { prodiId: true } },
            },
          },
        },
      },
      peserta: {
        orderBy: { mahasiswa: { nim: "asc" } },
        include: {
          mahasiswa: { select: { id: true, nim: true, nama: true, angkatan: true } },
          nilai: { select: { asesmenKode: true, skor: true } },
          nilaiButir: { select: { butirKisiKisiId: true, skor: true } },
        },
      },
    },
  });
}

export type KelasRpkps = Awaited<ReturnType<typeof muatKelasRpkps>>[number];

export async function muatKelasRpkps(klien: Klien, rpkpsId: string) {
  return klien.kelas.findMany({
    where: { rpkpsId },
    orderBy: { kode: "asc" },
    include: {
      dosen: { select: { id: true, nama: true } },
      peserta: {
        orderBy: { mahasiswa: { nim: "asc" } },
        include: {
          mahasiswa: { select: { id: true, nim: true, nama: true, angkatan: true } },
          nilai: { select: { asesmenKode: true, skor: true } },
          nilaiButir: { select: { butirKisiKisiId: true, skor: true } },
        },
      },
    },
  });
}

/**
 * Kelas beserta evaluasinya. Dipakai halaman evaluasi dan ekspor portofolio.
 */
export type KelasEvaluasi = NonNullable<Awaited<ReturnType<typeof muatKelasEvaluasi>>>;

export async function muatKelasEvaluasi(klien: Klien, kelasId: string) {
  return klien.kelas.findUnique({
    where: { id: kelasId },
    include: {
      dosen: { select: { id: true, nama: true } },
      rpkps: {
        select: {
          id: true,
          ambangKelulusanMhs: true,
          ambangKetercapaianMk: true,
          tahunAkademik: { select: { id: true, kode: true, tahunMulai: true } },
          mataKuliah: {
            select: {
              id: true,
              kode: true,
              nama: true,
              kurikulum: { select: { id: true, prodiId: true } },
            },
          },
        },
      },
      peserta: {
        orderBy: { mahasiswa: { nim: "asc" } },
        include: {
          mahasiswa: { select: { nim: true, nama: true } },
          nilai: { select: { asesmenKode: true, skor: true } },
          nilaiButir: { select: { butirKisiKisiId: true, skor: true } },
        },
      },
      evaluasi: { include: SERTAKAN_EVALUASI },
    },
  });
}

/**
 * Temuan semester sebelumnya pada mata kuliah yang sama yang belum
 * diverifikasi. Inilah bahan penutup lingkaran PPEPP: tindak lanjut yang
 * dijanjikan semester lalu ditagih di sini.
 */
export async function muatTemuanBelumDiverifikasi(
  klien: Klien,
  mataKuliahId: string,
  kecualiKelasId: string,
) {
  return klien.temuanEvaluasi.findMany({
    where: {
      statusVerifikasi: "BELUM",
      evaluasi: {
        status: "DITUTUP",
        kelasId: { not: kecualiKelasId },
        kelas: { rpkps: { mataKuliahId } },
      },
    },
    orderBy: [{ tingkat: "asc" }, { kode: "asc" }],
    include: {
      taSasaran: { select: { kode: true } },
      evaluasi: {
        select: {
          kelas: {
            select: { kode: true, rpkps: { select: { tahunAkademik: { select: { kode: true } } } } },
          },
        },
      },
    },
  });
}

export async function ambilSnapshotEvaluasi(klien: Klien, evaluasiId: string, versi: number) {
  return klien.evaluasiSnapshot.findUnique({
    where: { evaluasiId_versi: { evaluasiId, versi } },
  });
}

/**
 * Baris capaian CPL dari seluruh evaluasi yang SUDAH DITUTUP pada satu prodi —
 * masukan agregasi tingkat prodi (E5).
 *
 * Hanya yang ditutup: capaian pada evaluasi yang masih terbuka belum menjadi
 * catatan resmi, dan memasukkannya akan membuat angka prodi bergerak setiap
 * kali seorang dosen menyunting nilai.
 */
export async function muatBarisCapaian(
  klien: Klien,
  prodiId: string,
  opsi: { tahunAkademikId?: string } = {},
): Promise<BarisCapaian[]> {
  const baris = await klien.hasilCapaian.findMany({
    where: {
      tingkat: "CPL",
      evaluasi: {
        status: "DITUTUP",
        kelas: {
          rpkps: {
            ...(opsi.tahunAkademikId ? { tahunAkademikId: opsi.tahunAkademikId } : {}),
            mataKuliah: { kurikulum: { prodiId } },
          },
        },
      },
    },
    include: {
      evaluasi: {
        select: {
          kelas: {
            select: {
              kode: true,
              rpkps: {
                select: {
                  tahunAkademik: { select: { kode: true, tahunMulai: true } },
                  mataKuliah: {
                    select: { kode: true, nama: true, sksTeori: true, sksPraktik: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return baris.map((b) => {
    const kelas = b.evaluasi.kelas;
    const mk = kelas.rpkps.mataKuliah;
    return {
      cplKode: b.kode,
      mkKode: mk.kode,
      mkNama: mk.nama,
      sks: mk.sksTeori + mk.sksPraktik,
      kelas: kelas.kode,
      tahunAkademik: kelas.rpkps.tahunAkademik.kode,
      tahunMulai: kelas.rpkps.tahunAkademik.tahunMulai,
      rerata: b.rerata === null ? null : Number(b.rerata),
      persenLulus: b.persenLulus === null ? null : Number(b.persenLulus),
      tercapai: b.tercapai,
      jumlahDinilai: b.jumlahDinilai,
    };
  });
}

/** CPL dan jumlah mata kuliah pada kurikulum terbaru satu prodi. */
export async function muatKonteksProdi(klien: Klien, prodiId: string) {
  const kurikulum = await klien.kurikulum.findFirst({
    where: { prodiId },
    orderBy: [{ status: "asc" }, { tahun: "desc" }],
    select: {
      id: true,
      nama: true,
      tahun: true,
      cpl: { orderBy: { kode: "asc" }, select: { kode: true, deskripsi: true } },
      _count: { select: { mataKuliah: true } },
    },
  });
  return kurikulum;
}
