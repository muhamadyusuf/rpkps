"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import { saringSubCpmkMilikRpkps } from "@/lib/rpkps/muat";

export type Hasil = { ok: boolean; pesan: string; id?: string };

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return {
    sesi,
    boleh,
    dapatDisunting: status === "DRAF" || status === "DIREVISI",
  };
}

const SkemaTugas = z.object({
  nama: z.string().trim().min(3, "Nama tugas minimal 3 karakter."),
  jenis: z.enum(["INDIVIDU", "KELOMPOK"]),
  mingguMulai: z.number().int().min(1).max(24),
  mingguSelesai: z.number().int().min(1).max(24),
  bobot: z.number().min(0).max(100),
  komponenNilaiId: z.string().nullable(),
  deskripsi: z.string().trim().min(1, "Deskripsi tugas wajib diisi."),
  uraianTugas: z.string().trim().nullable(),
  formatLuaran: z.string().trim().nullable(),
  ketentuanLain: z.string().trim().nullable(),
  subCpmkId: z.array(z.string()).max(30),
  kriteria: z
    .array(
      z.object({
        indikator: z.string().trim().min(1),
        rincian: z.array(z.string().trim().min(1)).max(15),
        bobot: z.number().min(0).max(100),
      }),
    )
    .max(20),
  linimasa: z
    .array(
      z.object({
        minggu: z.number().int().min(1).max(24),
        tahapan: z.string().trim().min(1),
        aktivitas: z.string().trim().min(1),
      }),
    )
    .max(24),
});

export type IsiTugas = z.infer<typeof SkemaTugas>;

export async function buatTugas(rpkpsId: string): Promise<Hasil> {
  const { boleh, dapatDisunting } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

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

  revalidatePath(`/rpkps/${rpkpsId}/tugas`);
  return { ok: true, pesan: "Tugas dibuat.", id: tugas.id };
}

export async function simpanTugas(tugasId: string, isi: IsiTugas): Promise<Hasil> {
  const tugas = await prisma.tugas.findUnique({
    where: { id: tugasId },
    select: { id: true, rpkpsId: true, nomor: true },
  });
  if (!tugas) return { ok: false, pesan: "Tugas tidak ditemukan." };

  const { boleh, dapatDisunting, sesi } = await pastikanWenang(tugas.rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  const parsed = SkemaTugas.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  if (d.mingguMulai > d.mingguSelesai) {
    return { ok: false, pesan: "Minggu mulai tidak boleh melebihi minggu selesai." };
  }

  const mingguLinimasa = d.linimasa.map((l) => l.minggu);
  if (new Set(mingguLinimasa).size !== mingguLinimasa.length) {
    return { ok: false, pesan: "Minggu pada linimasa tidak boleh berulang." };
  }

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { sah: subCpmkSah, asing } = await saringSubCpmkMilikRpkps(
    tugas.rpkpsId,
    d.subCpmkId,
  );
  if (asing.length > 0) {
    return { ok: false, pesan: "Ada Sub-CPMK di luar mata kuliah RPKPS ini." };
  }

  await prisma.$transaction([
    prisma.tugas.update({
      where: { id: tugasId },
      data: {
        nama: d.nama,
        jenis: d.jenis,
        mingguMulai: d.mingguMulai,
        mingguSelesai: d.mingguSelesai,
        bobot: d.bobot,
        komponenNilaiId: d.komponenNilaiId,
        deskripsi: d.deskripsi,
        uraianTugas: d.uraianTugas,
        formatLuaran: d.formatLuaran,
        ketentuanLain: d.ketentuanLain,
      },
    }),
    prisma.tugasSubCpmk.deleteMany({ where: { tugasId } }),
    prisma.tugasSubCpmk.createMany({
      data: subCpmkSah.map((subCpmkId) => ({ tugasId, subCpmkId })),
    }),
    prisma.kriteriaTugas.deleteMany({ where: { tugasId } }),
    prisma.kriteriaTugas.createMany({
      data: d.kriteria.map((k, i) => ({
        tugasId,
        nomor: i + 1,
        indikator: k.indikator,
        rincian: k.rincian,
        bobot: k.bobot,
      })),
    }),
    prisma.linimasaTugas.deleteMany({ where: { tugasId } }),
    prisma.linimasaTugas.createMany({
      data: d.linimasa.map((l) => ({
        tugasId,
        minggu: l.minggu,
        tahapan: l.tahapan,
        aktivitas: l.aktivitas,
      })),
    }),
  ]);

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "TUGAS_DISIMPAN",
      entitas: "tugas",
      entitasId: tugasId,
      ringkasan: `${sesi.email} menyimpan tugas ${tugas.nomor}`,
    },
  });

  revalidatePath(`/rpkps/${tugas.rpkpsId}`);
  revalidatePath(`/rpkps/${tugas.rpkpsId}/tugas`);
  return { ok: true, pesan: "Tugas tersimpan." };
}

export async function hapusTugas(tugasId: string): Promise<Hasil> {
  const tugas = await prisma.tugas.findUnique({
    where: { id: tugasId },
    select: { id: true, rpkpsId: true, nama: true },
  });
  if (!tugas) return { ok: false, pesan: "Tugas tidak ditemukan." };

  const { boleh, dapatDisunting } = await pastikanWenang(tugas.rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  await prisma.tugas.delete({ where: { id: tugasId } });
  revalidatePath(`/rpkps/${tugas.rpkpsId}/tugas`);
  return { ok: true, pesan: "Tugas dihapus." };
}
