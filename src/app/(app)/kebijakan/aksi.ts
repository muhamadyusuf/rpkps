"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";

/**
 * Memberlakukan kebijakan. Hanya boleh ada satu kebijakan BERLAKU per institusi
 * pada satu waktu — kebijakan lama diarsipkan dalam transaksi yang sama supaya
 * tidak pernah ada dua kebijakan aktif yang saling bertentangan.
 */
export async function berlakukanKebijakan(kebijakanId: string) {
  const sesi = await wajibPeran("ADMIN", "GPM");

  const kebijakan = await prisma.kebijakanBebanBelajar.findUnique({
    where: { id: kebijakanId },
    select: { id: true, institusiId: true, nama: true, status: true },
  });

  if (!kebijakan) return { ok: false as const, pesan: "Kebijakan tidak ditemukan." };
  if (kebijakan.status === "BERLAKU") {
    return { ok: false as const, pesan: "Kebijakan ini sudah berlaku." };
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

  revalidatePath("/kebijakan");
  revalidatePath("/dashboard");
  return { ok: true as const, pesan: "Kebijakan diberlakukan." };
}
