"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import type { LevelBloom } from "@/generated/prisma";
import {
  geserUrutan,
  normalkanKode,
  periksaKelayakanHapusCpmk,
  periksaKelayakanHapusSubCpmk,
} from "@/domain/kurikulum/sunting";
import {
  catatSunting,
  pastikanWenangSunting,
  pesanKelayakan,
  segarkanKurikulum,
  sensusCpmk,
  sensusSubCpmk,
  urutanBerikutnya,
} from "@/lib/kurikulum/sunting";
import type { HasilSimpan } from "./aksi";

/**
 * CRUD CPMK dan Sub-CPMK dari halaman mata kuliah. Acuan: docs/15 §4.
 *
 * Berkas ini yang paling dekat dengan garis keras proyek: CPMK dan Sub-CPMK
 * read-only di penyusun RPKPS, dan perubahannya pada kurikulum HIDUP hanya
 * lewat Usulan Revisi Kurikulum. Yang dibuka di sini adalah penyusunan
 * kurikulum yang belum diberlakukan — gerbang `pastikanWenangSunting` menolak
 * status apa pun selain DRAF, dan `periksaKelayakanHapusSubCpmk` menegakkan
 * "capaian dipensiunkan, tidak pernah dihapus" untuk baris yang sudah dirujuk.
 *
 * `pensiunSejakTaId` TIDAK disentuh di sini: pensiun butuh tahun akademik mulai
 * berlaku, dan itu keputusan Kaprodi lewat butir usulan (docs/15 §2.4).
 */

const LEVEL: readonly LevelBloom[] = [
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
];

const skemaLevel = z.enum(LEVEL as [LevelBloom, ...LevelBloom[]]).nullable();

const SkemaCpmk = z.object({
  kode: z
    .string()
    .trim()
    .min(1, "@aksi.periksa.kodeCpmkWajib")
    .max(30, "@aksi.periksa.kodeCpmkPanjang")
    .transform(normalkanKode),
  rumusan: z
    .string()
    .trim()
    .min(15, "@aksi.periksa.rumusanCpmkPendek"),
  /**
   * Rumusan berbahasa Inggris. Opsional, tanpa panjang minimum, dan tidak
   * pernah menjadi acuan validator: yang disahkan adalah rumusan Indonesia
   * (docs/11 §5.4).
   */
  rumusanEn: z.string().trim().max(2000).nullable(),
  levelBloom: skemaLevel,
});

const SkemaSubCpmk = z.object({
  kode: z
    .string()
    .trim()
    .min(1, "@aksi.periksa.kodeSubWajib")
    .max(30, "@aksi.periksa.kodeSubPanjang")
    .transform(normalkanKode),
  rumusan: z
    .string()
    .trim()
    .min(15, "@aksi.periksa.rumusanSubPendek"),
  rumusanEn: z.string().trim().max(2000).nullable(),
  levelBloom: skemaLevel,
  /** Kata kerja operasional. Yang diperiksa validator sebagai keterukuran. */
  kko: z.string().trim().max(60).nullable(),
  /**
   * Usulan minggu pelaksanaan dari kurikulum; RPKPS boleh menyusun ulang.
   * Dirapikan di sini — berulang dan tidak urut hanya membingungkan penyusun.
   */
  mingguDisarankan: z
    .array(z.number().int().min(1).max(20))
    .max(20)
    .transform((v) => [...new Set(v)].sort((a, b) => a - b)),
});

export type MasukanCpmk = z.input<typeof SkemaCpmk>;
export type MasukanSubCpmk = z.input<typeof SkemaSubCpmk>;

/** Induk sebuah CPMK: mata kuliah dan kurikulumnya, untuk gerbang dan cache. */
type Induk = { kurikulumId: string; mataKuliahId: string };

async function indukCpmk(cpmkId: string): Promise<Induk | null> {
  const c = await prisma.cpmk.findUnique({
    where: { id: cpmkId },
    select: { mataKuliahId: true, mataKuliah: { select: { kurikulumId: true } } },
  });
  return c ? { kurikulumId: c.mataKuliah.kurikulumId, mataKuliahId: c.mataKuliahId } : null;
}

async function indukSubCpmk(subCpmkId: string): Promise<(Induk & { cpmkId: string }) | null> {
  const s = await prisma.subCpmk.findUnique({
    where: { id: subCpmkId },
    select: {
      cpmkId: true,
      cpmk: {
        select: { mataKuliahId: true, mataKuliah: { select: { kurikulumId: true } } },
      },
    },
  });
  return s
    ? {
        cpmkId: s.cpmkId,
        mataKuliahId: s.cpmk.mataKuliahId,
        kurikulumId: s.cpmk.mataKuliah.kurikulumId,
      }
    : null;
}

/* ------------------------------------------------------------------ */
/* CPMK                                                               */
/* ------------------------------------------------------------------ */

export async function tambahCpmk(
  mataKuliahId: string,
  masukan: MasukanCpmk,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const mk = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: { kurikulumId: true },
  });
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };

  const wenang = await pastikanWenangSunting(mk.kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaCpmk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  // Kode CPMK unik DI DALAM satu mata kuliah, bukan lintas kurikulum.
  const bentrok = await prisma.cpmk.findFirst({
    where: { mataKuliahId, kode: parsed.data.kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAdaMk, { kode: parsed.data.kode }) };
  }

  const terakhir = await prisma.cpmk.findFirst({
    where: { mataKuliahId },
    orderBy: { urutan: "desc" },
    select: { urutan: true },
  });

  await prisma.cpmk.create({
    data: {
      mataKuliahId,
      ...parsed.data,
      urutan: urutanBerikutnya(terakhir),
      // Ditulis tangan oleh Kaprodi, bukan diterima dari usulan AI.
      sumber: "KURIKULUM",
    },
  });

  await catatSunting(wenang.sesi, mk.kurikulumId, `menambah ${parsed.data.kode}`);
  segarkanKurikulum(mk.kurikulumId, mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDitambahkan, { kode: parsed.data.kode }) };
}

export async function perbaruiCpmk(id: string, masukan: MasukanCpmk): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.cpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaCpmk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.cpmk.findFirst({
    where: { mataKuliahId: induk.mataKuliahId, kode: parsed.data.kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAdaMk, { kode: parsed.data.kode }) };
  }

  await prisma.cpmk.update({ where: { id }, data: parsed.data });

  await catatSunting(wenang.sesi, induk.kurikulumId, `menyunting ${parsed.data.kode}`);
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDiperbarui, { kode: parsed.data.kode }) };
}

export async function hapusCpmk(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.cpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const sensus = await sensusCpmk(id);
  if (!sensus) return { ok: false, pesan: kam.aksi.takAda.cpmk };
  const kelayakan = periksaKelayakanHapusCpmk(sensus);
  if (!kelayakan.boleh) return { ok: false, pesan: pesanKelayakan(kelayakan) };

  await prisma.cpmk.delete({ where: { id } });

  await catatSunting(wenang.sesi, induk.kurikulumId, `menghapus ${sensus.kode}`);
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDihapus, { kode: sensus.kode }) };
}

export async function geserCpmk(id: string, arah: "naik" | "turun"): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.cpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const daftar = await prisma.cpmk.findMany({
    where: { mataKuliahId: induk.mataKuliahId },
    select: { id: true, urutan: true },
  });

  const baru = geserUrutan(daftar, id, arah);
  if (!baru) return { ok: true, pesan: kam.aksi.umum.tersimpan };

  await prisma.$transaction(
    baru.map((x) => prisma.cpmk.update({ where: { id: x.id }, data: { urutan: x.urutan } })),
  );

  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: kam.aksi.umum.tersimpan };
}

/**
 * Menyetel CPL yang dijabarkan sebuah CPMK — peta CPMK×CPL.
 *
 * CPL yang boleh dipilih dibatasi pada yang DIBEBANKAN ke mata kuliah induk.
 * Bukan sekadar milik kurikulum yang sama: CPMK yang menjabarkan CPL di luar
 * matriks CPL×MK membuat rantai telusur PL → CPL → CPMK putus di tengah, dan
 * angka ketercapaian CPL prodi menghitung mata kuliah yang tidak pernah
 * dibebani CPL itu.
 */
export async function setelCplCpmk(cpmkId: string, cplId: string[]): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukCpmk(cpmkId);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.cpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const sah = await prisma.cpl.findMany({
    where: {
      id: { in: [...new Set(cplId)] },
      kurikulumId: induk.kurikulumId,
      mataKuliah: { some: { mataKuliahId: induk.mataKuliahId } },
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.petaCpmkCpl.deleteMany({ where: { cpmkId } }),
    prisma.petaCpmkCpl.createMany({
      data: sah.map((c) => ({ cpmkId, cplId: c.id })),
    }),
  ]);

  const cpmk = await prisma.cpmk.findUnique({ where: { id: cpmkId }, select: { kode: true } });
  await catatSunting(
    wenang.sesi,
    induk.kurikulumId,
    `menyetel ${sah.length} CPL pada ${cpmk?.kode ?? cpmkId}`,
  );
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return {
    ok: true,
    pesan: sisip(kam.aksi.kurikulum.pemetaanDisetel, {
      jumlah: sah.length,
      kode: cpmk?.kode ?? "",
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Sub-CPMK                                                           */
/* ------------------------------------------------------------------ */

export async function tambahSubCpmk(
  cpmkId: string,
  masukan: MasukanSubCpmk,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukCpmk(cpmkId);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.cpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaSubCpmk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.subCpmk.findFirst({
    where: { cpmkId, kode: parsed.data.kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAdaMk, { kode: parsed.data.kode }) };
  }

  const terakhir = await prisma.subCpmk.findFirst({
    where: { cpmkId },
    orderBy: { urutan: "desc" },
    select: { urutan: true },
  });

  await prisma.subCpmk.create({
    data: {
      cpmkId,
      ...parsed.data,
      urutan: urutanBerikutnya(terakhir),
      sumber: "KURIKULUM",
    },
  });

  await catatSunting(wenang.sesi, induk.kurikulumId, `menambah ${parsed.data.kode}`);
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDitambahkan, { kode: parsed.data.kode }) };
}

export async function perbaruiSubCpmk(
  id: string,
  masukan: MasukanSubCpmk,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukSubCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.subCpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaSubCpmk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.subCpmk.findFirst({
    where: { cpmkId: induk.cpmkId, kode: parsed.data.kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAdaMk, { kode: parsed.data.kode }) };
  }

  await prisma.subCpmk.update({ where: { id }, data: parsed.data });

  await catatSunting(wenang.sesi, induk.kurikulumId, `menyunting ${parsed.data.kode}`);
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDiperbarui, { kode: parsed.data.kode }) };
}

export async function hapusSubCpmk(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukSubCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.subCpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  // Tiga rujukannya — pertemuan, tugas, butir kisi-kisi — semuanya
  // `onDelete: Cascade`. Tanpa gerbang ini, menghapus satu Sub-CPMK
  // melenyapkan baris RPKPS berjalan tanpa satu pesan pun.
  const sensus = await sensusSubCpmk(id);
  if (!sensus) return { ok: false, pesan: kam.aksi.takAda.subCpmk };
  const kelayakan = periksaKelayakanHapusSubCpmk(sensus);
  if (!kelayakan.boleh) return { ok: false, pesan: pesanKelayakan(kelayakan) };

  await prisma.subCpmk.delete({ where: { id } });

  await catatSunting(wenang.sesi, induk.kurikulumId, `menghapus ${sensus.kode}`);
  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDihapus, { kode: sensus.kode }) };
}

export async function geserSubCpmk(id: string, arah: "naik" | "turun"): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const induk = await indukSubCpmk(id);
  if (!induk) return { ok: false, pesan: kam.aksi.takAda.subCpmk };

  const wenang = await pastikanWenangSunting(induk.kurikulumId);
  if (!wenang.ok) return wenang;

  const daftar = await prisma.subCpmk.findMany({
    where: { cpmkId: induk.cpmkId },
    select: { id: true, urutan: true },
  });

  const baru = geserUrutan(daftar, id, arah);
  if (!baru) return { ok: true, pesan: kam.aksi.umum.tersimpan };

  await prisma.$transaction(
    baru.map((x) => prisma.subCpmk.update({ where: { id: x.id }, data: { urutan: x.urutan } })),
  );

  segarkanKurikulum(induk.kurikulumId, induk.mataKuliahId);
  return { ok: true, pesan: kam.aksi.umum.tersimpan };
}
