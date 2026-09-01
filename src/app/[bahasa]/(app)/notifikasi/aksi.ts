"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibAktif } from "@/lib/otorisasi";
import { jalurAktif } from "@/lib/bahasa/server";
import { segarkan } from "@/lib/bahasa/segarkan";

/**
 * Notifikasi milik SATU pengguna, dan hanya pemiliknya yang boleh menyentuhnya.
 * Karena itu setiap `where` di berkas ini menyertakan `penggunaId` — bukan
 * hanya id barisnya, yang dapat ditebak dari mana saja.
 */

export async function bukaNotifikasi(id: string) {
  const sesi = await wajibAktif();

  const baris = await prisma.notifikasi.findFirst({
    where: { id, penggunaId: sesi.id },
    select: { tautan: true },
  });
  if (!baris) redirect(await jalurAktif("/notifikasi"));

  await prisma.notifikasi.updateMany({
    where: { id, penggunaId: sesi.id, dibacaPada: null },
    data: { dibacaPada: new Date() },
  });

  redirect(await jalurAktif(baris.tautan ?? "/notifikasi"));
}

export async function tandaiSemuaDibaca() {
  const sesi = await wajibAktif();
  await prisma.notifikasi.updateMany({
    where: { penggunaId: sesi.id, dibacaPada: null },
    data: { dibacaPada: new Date() },
  });
  segarkan("/notifikasi", "/dashboard");
}
