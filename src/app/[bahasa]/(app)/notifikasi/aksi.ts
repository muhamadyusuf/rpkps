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

/**
 * Menyalakan atau mematikan kanal surel bagi pengguna ini — docs/10 §2.5.
 *
 * Hanya menyentuh KANAL LUAR. Notifikasi dalam aplikasi tidak dapat dimatikan
 * dari mana pun: ia tempat pekerjaan diberitahukan, dan mematikannya berarti
 * mematikan alat kerjanya sendiri. Yang boleh dipilih adalah apakah kabar itu
 * ikut menyusul ke kotak surat.
 *
 * Berlaku untuk peristiwa BERIKUTNYA. Baris yang sudah telanjur mengantre
 * tetap diperiksa ulang saat dikuras, jadi mematikannya sekarang juga
 * membatalkan yang belum sempat terkirim.
 */
export async function setelSurelNotifikasi(nyala: boolean) {
  const sesi = await wajibAktif();
  await prisma.pengguna.update({
    where: { id: sesi.id },
    data: { surelNotifikasi: nyala },
  });
  segarkan("/notifikasi");
}
