"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { kamusAksi } from "@/lib/bahasa/server";
import { segarkan } from "@/lib/bahasa/segarkan";

/**
 * Tinjauan atas temuan perangkap (docs/22). Satu-satunya aksi tulis di modul
 * ini, dan hanya ADMIN: temuan memuat IP dan lokasi perkiraan orang.
 *
 * Temuan itu sendiri TIDAK dapat dihapus dari sini — jejak yang bisa dihapus
 * lewat peramban adalah jejak yang hilang tepat saat ia dibutuhkan untuk
 * laporan. Yang berubah hanya status dan catatan.
 */

const SkemaTinjauan = z.object({
  status: z.enum(["BARU", "DITINJAU", "DILAPORKAN", "DIABAIKAN"]),
  catatan: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === "" ? null : v)),
});

export type HasilAksi = { ok: boolean; pesan: string };

export async function simpanTinjauan(id: string, data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaTinjauan.safeParse({
    status: data.get("status"),
    catatan: data.get("catatan") ?? "",
  });
  if (!parsed.success) return { ok: false, pesan: kam.perangkap.aksi.statusTidakValid };

  const ubah = await prisma.perangkapTemuan.updateMany({
    where: { id },
    data: {
      status: parsed.data.status,
      catatan: parsed.data.catatan,
      ditinjauOleh: sesi.email,
      ditinjauPada: new Date(),
    },
  });
  if (ubah.count === 0) return { ok: false, pesan: kam.perangkap.aksi.tidakDitemukan };

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PERANGKAP_DITINJAU",
      entitas: "perangkap_temuan",
      entitasId: id,
      ringkasan: `${sesi.email} menandai temuan perangkap sebagai ${parsed.data.status}`,
    },
  });

  segarkan("/perangkap", `/perangkap/${id}`);
  return { ok: true, pesan: kam.perangkap.aksi.tersimpan };
}
