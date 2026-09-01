"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { periksaKesegaran, pesanTertimpa } from "@/domain/rpkps/kunci-optimistik";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { saringSubCpmkMilikRpkps } from "@/lib/rpkps/muat";
import { kamusAksi } from "@/lib/bahasa/server";
import { pesanZod } from "@/lib/bahasa/zod";

export type Hasil = { ok: boolean; pesan: string; id?: string };

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return {
    sesi,
    boleh,
    status,
    dapatDisunting: bolehSuntingIsi(status),
  };
}

/** Medan `*En` wajib ikut — alasannya sama dengan `SkemaPertemuan` (§5.3). */
const SkemaTugas = z.object({
  nama: z.string().trim().min(3, "@aksi.periksa.namaTugasMinimal"),
  namaEn: z.string().trim().nullable(),
  jenis: z.enum(["INDIVIDU", "KELOMPOK"]),
  mingguMulai: z.number().int().min(1).max(24),
  mingguSelesai: z.number().int().min(1).max(24),
  bobot: z.number().min(0).max(100),
  komponenNilaiId: z.string().nullable(),
  deskripsi: z.string().trim().min(1, "@aksi.periksa.deskripsiTugasWajib"),
  deskripsiEn: z.string().trim().nullable(),
  uraianTugas: z.string().trim().nullable(),
  uraianTugasEn: z.string().trim().nullable(),
  formatLuaran: z.string().trim().nullable(),
  formatLuaranEn: z.string().trim().nullable(),
  ketentuanLain: z.string().trim().nullable(),
  ketentuanLainEn: z.string().trim().nullable(),
  subCpmkId: z.array(z.string()).max(30),
  kriteria: z
    .array(
      z.object({
        indikator: z.string().trim().min(1),
        indikatorEn: z.string().trim().nullable(),
        rincian: z.array(z.string().trim().min(1)).max(15),
        rincianEn: z.array(z.string().trim()).max(15),
        bobot: z.number().min(0).max(100),
      }),
    )
    .max(20),
  linimasa: z
    .array(
      z.object({
        minggu: z.number().int().min(1).max(24),
        tahapan: z.string().trim().min(1),
        tahapanEn: z.string().trim().nullable(),
        aktivitas: z.string().trim().min(1),
        aktivitasEn: z.string().trim().nullable(),
      }),
    )
    .max(24),
});

export type IsiTugas = z.infer<typeof SkemaTugas>;

export async function buatTugas(rpkpsId: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const terakhir = await prisma.tugas.findFirst({
    where: { rpkpsId },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });

  const tugas = await prisma.tugas.create({
    data: {
      rpkpsId,
      nomor: (terakhir?.nomor ?? 0) + 1,
      nama: "Tugas baru",
      mingguMulai: 1,
      mingguSelesai: 16,
      deskripsi: "",
    },
    select: { id: true },
  });

  segarkan(`/rpkps/${rpkpsId}/tugas`);
  return { ok: true, pesan: kam.aksi.tugas.dibuat, id: tugas.id };
}

export async function simpanTugas(
  tugasId: string,
  isi: IsiTugas,
  /** Cap `diubahPada` saat penyunting membuka lembar ini — lihat `simpanPertemuan`. */
  capVersi?: string | null,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const tugas = await prisma.tugas.findUnique({
    where: { id: tugasId },
    select: { id: true, rpkpsId: true, nomor: true },
  });
  if (!tugas) return { ok: false, pesan: kam.aksi.takAda.tugas };

  const sebutan = `Tugas ${tugas.nomor}`;
  const kesegaran = periksaKesegaran(capVersi, sebutan);
  if (!kesegaran.segar) return { ok: false, pesan: kesegaran.pesan };

  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(tugas.rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const parsed = SkemaTugas.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }
  const d = parsed.data;

  if (d.mingguMulai > d.mingguSelesai) {
    return { ok: false, pesan: kam.aksi.tugas.mingguTerbalik };
  }

  const mingguLinimasa = d.linimasa.map((l) => l.minggu);
  if (new Set(mingguLinimasa).size !== mingguLinimasa.length) {
    return { ok: false, pesan: kam.aksi.tugas.mingguBerulang };
  }

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { sah: subCpmkSah, asing } = await saringSubCpmkMilikRpkps(
    tugas.rpkpsId,
    d.subCpmkId,
  );
  if (asing.length > 0) {
    return { ok: false, pesan: kam.aksi.tugas.subDiLuarMk };
  }

  // Cap versi ikut ke `where`, sehingga pemeriksaan dan penulisan menjadi satu
  // pernyataan yang tidak dapat disela. Bila kalah balapan, `count` nol dan
  // tidak satu pun kriteria maupun linimasa tersentuh.
  const menang = await prisma.$transaction(async (tx) => {
    const hasil = await tx.tugas.updateMany({
      where: { id: tugasId, diubahPada: kesegaran.cap },
      data: {
        nama: d.nama,
        namaEn: d.namaEn,
        jenis: d.jenis,
        mingguMulai: d.mingguMulai,
        mingguSelesai: d.mingguSelesai,
        bobot: d.bobot,
        komponenNilaiId: d.komponenNilaiId,
        deskripsi: d.deskripsi,
        deskripsiEn: d.deskripsiEn,
        uraianTugas: d.uraianTugas,
        uraianTugasEn: d.uraianTugasEn,
        formatLuaran: d.formatLuaran,
        formatLuaranEn: d.formatLuaranEn,
        ketentuanLain: d.ketentuanLain,
        ketentuanLainEn: d.ketentuanLainEn,
      },
    });
    if (hasil.count === 0) return false;

    await tx.tugasSubCpmk.deleteMany({ where: { tugasId } });
    await tx.tugasSubCpmk.createMany({
      data: subCpmkSah.map((subCpmkId) => ({ tugasId, subCpmkId })),
    });
    await tx.kriteriaTugas.deleteMany({ where: { tugasId } });
    await tx.kriteriaTugas.createMany({
      data: d.kriteria.map((k, i) => ({
        tugasId,
        nomor: i + 1,
        indikator: k.indikator,
        indikatorEn: k.indikatorEn,
        rincian: k.rincian,
        rincianEn: k.rincianEn,
        bobot: k.bobot,
      })),
    });
    await tx.linimasaTugas.deleteMany({ where: { tugasId } });
    await tx.linimasaTugas.createMany({
      data: d.linimasa.map((l) => ({
        tugasId,
        minggu: l.minggu,
        tahapan: l.tahapan,
        tahapanEn: l.tahapanEn,
        aktivitas: l.aktivitas,
        aktivitasEn: l.aktivitasEn,
      })),
    });
    return true;
  });

  if (!menang) return { ok: false, pesan: pesanTertimpa(sebutan) };

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "TUGAS_DISIMPAN",
      entitas: "tugas",
      entitasId: tugasId,
      ringkasan: `${sesi.email} menyimpan tugas ${tugas.nomor}`,
    },
  });

  segarkan(`/rpkps/${tugas.rpkpsId}`);
  segarkan(`/rpkps/${tugas.rpkpsId}/tugas`);
  return { ok: true, pesan: kam.aksi.tugas.tersimpan };
}

export async function hapusTugas(tugasId: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const tugas = await prisma.tugas.findUnique({
    where: { id: tugasId },
    select: { id: true, rpkpsId: true, nama: true },
  });
  if (!tugas) return { ok: false, pesan: kam.aksi.takAda.tugas };

  const { boleh, dapatDisunting, status } = await pastikanWenang(tugas.rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  await prisma.tugas.delete({ where: { id: tugasId } });
  segarkan(`/rpkps/${tugas.rpkpsId}/tugas`);
  return { ok: true, pesan: kam.aksi.tugas.dihapus };
}
