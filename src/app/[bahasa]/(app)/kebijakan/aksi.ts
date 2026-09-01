"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { kamusAksi } from "@/lib/bahasa/server";

/**
 * Memberlakukan kebijakan. Hanya boleh ada satu kebijakan BERLAKU per institusi
 * pada satu waktu — kebijakan lama diarsipkan dalam transaksi yang sama supaya
 * tidak pernah ada dua kebijakan aktif yang saling bertentangan.
 */
export async function berlakukanKebijakan(kebijakanId: string) {
  const sesi = await wajibPeran("ADMIN", "GPM");
  const k = await kamusAksi();

  const kebijakan = await prisma.kebijakanBebanBelajar.findUnique({
    where: { id: kebijakanId },
    select: { id: true, institusiId: true, nama: true, status: true },
  });

  if (!kebijakan) return { ok: false as const, pesan: k.aksi.takAda.kebijakan };
  if (kebijakan.status === "BERLAKU") {
    return { ok: false as const, pesan: k.aksi.kebijakan.sudahBerlaku };
  }

  await prisma.$transaction([
    prisma.kebijakanBebanBelajar.updateMany({
      where: {
        institusiId: kebijakan.institusiId,
        status: "BERLAKU",
        id: { not: kebijakan.id },
      },
      data: { status: "ARSIP", berlakuSampai: new Date() },
    }),
    prisma.kebijakanBebanBelajar.update({
      where: { id: kebijakan.id },
      data: { status: "BERLAKU" },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "KEBIJAKAN_DIBERLAKUKAN",
        entitas: "kebijakan_beban_belajar",
        entitasId: kebijakan.id,
        ringkasan: `${sesi.email} memberlakukan "${kebijakan.nama}"`,
      },
    }),
  ]);

  segarkan("/kebijakan");
  segarkan("/dashboard");
  return { ok: true as const, pesan: k.aksi.kebijakan.diberlakukan };
}
