"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { kamusAksi } from "@/lib/bahasa/server";
// Parameter fungsi ini bernama `isi`, jadi perakit kalimatnya dialiaskan.
import { isi as sisip } from "@/lib/bahasa/teks";
import { saringSubCpmkMilikRpkps } from "@/lib/rpkps/muat";
import { pesanZod } from "@/lib/bahasa/zod";

export type Hasil = { ok: boolean; pesan: string };

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return {
    sesi,
    boleh,
    status,
    dapatDisunting: bolehSuntingIsi(status),
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
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  const k = await kamusAksi();
  if (!boleh) return { ok: false, pesan: k.aksi.wenang.umum };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, k) };

  const parsed = SkemaKisiKisi.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }
  const d = parsed.data;

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { asing } = await saringSubCpmkMilikRpkps(
    rpkpsId,
    d.butir.map((b) => b.subCpmkId),
  );
  if (asing.length > 0) {
    return { ok: false, pesan: k.aksi.kisiKisi.butirDiLuarMk };
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

  segarkan(`/rpkps/${rpkpsId}/kisi-kisi`);
  segarkan(`/rpkps/${rpkpsId}`);
  return { ok: true, pesan: sisip(k.aksi.kisiKisi.tersimpan, { jenis }) };
}
