"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import { saringSubCpmkMilikRpkps } from "@/lib/rpkps/muat";

export type Hasil = { ok: boolean; pesan: string };

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return {
    sesi,
    boleh,
    dapatDisunting: status === "DRAF" || status === "DIREVISI",
  };
}

const LEVEL = [
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
] as const;

const SkemaKisiKisi = z.object({
  totalSkor: z.number().min(1).max(1000),
  durasiMenit: z.number().int().min(0).max(600).nullable(),
  catatan: z.string().trim().nullable(),
  butir: z
    .array(
      z.object({
        subCpmkId: z.string().min(1),
        levelBloom: z.enum(LEVEL),
        bentuk: z.enum([
          "PILIHAN_GANDA", "ESAI", "URAIAN_SINGKAT",
          "STUDI_KASUS", "PRAKTIK", "PROYEK", "LISAN",
        ]),
        jumlahButir: z.number().int().min(1).max(200),
        skor: z.number().min(0).max(1000),
        indikator: z.string().trim().nullable(),
      }),
    )
    .max(100),
});

export type IsiKisiKisi = z.infer<typeof SkemaKisiKisi>;

export async function simpanKisiKisi(
  rpkpsId: string,
  jenis: "UTS" | "UAS",
  isi: IsiKisiKisi,
): Promise<Hasil> {
  const { boleh, dapatDisunting, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  const parsed = SkemaKisiKisi.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { asing } = await saringSubCpmkMilikRpkps(
    rpkpsId,
    d.butir.map((b) => b.subCpmkId),
  );
  if (asing.length > 0) {
    return { ok: false, pesan: "Ada butir yang merujuk Sub-CPMK di luar mata kuliah ini." };
  }

  const kisiKisi = await prisma.kisiKisi.upsert({
    where: { rpkpsId_jenis: { rpkpsId, jenis } },
    update: { totalSkor: d.totalSkor, durasiMenit: d.durasiMenit, catatan: d.catatan },
    create: {
      rpkpsId,
      jenis,
      totalSkor: d.totalSkor,
      durasiMenit: d.durasiMenit,
      catatan: d.catatan,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.butirKisiKisi.deleteMany({ where: { kisiKisiId: kisiKisi.id } }),
    prisma.butirKisiKisi.createMany({
      data: d.butir.map((b, i) => ({
        kisiKisiId: kisiKisi.id,
        nomor: i + 1,
        subCpmkId: b.subCpmkId,
        levelBloom: b.levelBloom,
        bentuk: b.bentuk,
        jumlahButir: b.jumlahButir,
        skor: b.skor,
        indikator: b.indikator,
      })),
    }),
  ]);

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "KISI_KISI_DISIMPAN",
      entitas: "kisi_kisi",
      entitasId: kisiKisi.id,
      ringkasan: `${sesi.email} menyimpan kisi-kisi ${jenis}`,
    },
  });

  revalidatePath(`/rpkps/${rpkpsId}/kisi-kisi`);
  revalidatePath(`/rpkps/${rpkpsId}`);
  return { ok: true, pesan: `Kisi-kisi ${jenis} tersimpan.` };
}
