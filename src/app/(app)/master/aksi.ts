"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { JenjangProdi, SemesterTipe } from "@/generated/prisma";

export type HasilAksi = { ok: boolean; pesan: string };

const SkemaProdi = z.object({
  nama: z.string().trim().min(3, "Nama prodi minimal 3 karakter."),
  kode: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter.")
    .transform((v) => v.toUpperCase()),
  jenjang: z.enum(["D3", "D4", "S1", "S2", "S3", "PROFESI"]),
  gelar: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function tambahProdi(data: FormData): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaProdi.safeParse({
    nama: data.get("nama"),
    kode: data.get("kode"),
    jenjang: data.get("jenjang"),
    gelar: data.get("gelar"),
  });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const fakultas = await prisma.fakultas.findFirst({ select: { id: true } });
  if (!fakultas) {
    return {
      ok: false,
      pesan: "Belum ada fakultas. Jalankan npm run db:seed lebih dulu.",
    };
  }

  try {
    await prisma.prodi.create({
      data: {
        ...parsed.data,
        jenjang: parsed.data.jenjang as JenjangProdi,
        fakultasId: fakultas.id,
      },
    });
  } catch (galat) {
    return {
      ok: false,
      pesan:
        galat instanceof Error && galat.message.includes("Unique constraint")
          ? `Kode prodi "${parsed.data.kode}" sudah dipakai.`
          : "Gagal menyimpan program studi.",
    };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PRODI_DITAMBAHKAN",
      entitas: "prodi",
      ringkasan: `${sesi.email} menambahkan prodi ${parsed.data.kode}`,
    },
  });

  revalidatePath("/master/prodi");
  return { ok: true, pesan: "Program studi ditambahkan." };
}

export async function ubahAktifProdi(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibPeran("ADMIN");
  await prisma.prodi.update({ where: { id }, data: { aktif } });
  revalidatePath("/master/prodi");
  return { ok: true, pesan: aktif ? "Prodi diaktifkan." : "Prodi dinonaktifkan." };
}

const SkemaTahun = z.object({
  tahunMulai: z.coerce
    .number()
    .int()
    .min(2000, "Tahun tidak masuk akal.")
    .max(2100, "Tahun tidak masuk akal."),
  semester: z.enum(["GANJIL", "GENAP", "ANTARA"]),
});

export async function tambahTahunAkademik(data: FormData): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaTahun.safeParse({
    tahunMulai: data.get("tahunMulai"),
    semester: data.get("semester"),
  });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { tahunMulai, semester } = parsed.data;
  const kode = `${tahunMulai}/${tahunMulai + 1}-${semester}`;

  try {
    await prisma.tahunAkademik.create({
      data: {
        kode,
        tahunMulai,
        tahunSelesai: tahunMulai + 1,
        semester: semester as SemesterTipe,
      },
    });
  } catch (galat) {
    return {
      ok: false,
      pesan:
        galat instanceof Error && galat.message.includes("Unique constraint")
          ? `Tahun akademik ${kode} sudah ada.`
          : "Gagal menyimpan tahun akademik.",
    };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "TAHUN_AKADEMIK_DITAMBAHKAN",
      entitas: "tahun_akademik",
      ringkasan: `${sesi.email} menambahkan ${kode}`,
    },
  });

  revalidatePath("/master/tahun-akademik");
  return { ok: true, pesan: `Tahun akademik ${kode} ditambahkan.` };
}

/** Hanya satu tahun akademik yang boleh aktif — sisanya dimatikan sekaligus. */
export async function aktifkanTahunAkademik(id: string): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  await prisma.$transaction([
    prisma.tahunAkademik.updateMany({
      where: { aktif: true, id: { not: id } },
      data: { aktif: false },
    }),
    prisma.tahunAkademik.update({ where: { id }, data: { aktif: true } }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "TAHUN_AKADEMIK_DIAKTIFKAN",
        entitas: "tahun_akademik",
        entitasId: id,
        ringkasan: `${sesi.email} mengaktifkan tahun akademik`,
      },
    }),
  ]);

  revalidatePath("/master/tahun-akademik");
  revalidatePath("/dashboard");
  return { ok: true, pesan: "Tahun akademik diaktifkan." };
}
