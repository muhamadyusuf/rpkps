"use server";

import { cookies } from "next/headers";
import { NAMA_COOKIE_BAHASA, adalahBahasa, type Bahasa } from "@/kamus";
import { prisma } from "@/lib/prisma";
import { sesiSaatIni } from "@/lib/sesi";

const SETAHUN = 60 * 60 * 24 * 365;

/**
 * Mencatat pilihan bahasa. Dipanggil pengalih bahasa SEBELUM ia berpindah
 * alamat.
 *
 * Dua tempat, dengan alasan berbeda:
 *
 * - **Cookie** — dibaca proxy, yang tidak boleh menyentuh basis data (runtime
 *   Edge). Inilah yang membuat tautan telanjang `/rpkps` mendarat di bahasa
 *   yang benar pada kunjungan berikutnya.
 * - **`Pengguna.bahasa`** — mengikuti ORANGNYA, bukan perambannya. Dosen yang
 *   membuka aplikasi dari komputer lab menemukan bahasanya sudah benar.
 *
 * Kegagalan menulis ke basis data sengaja tidak menggagalkan perpindahan:
 * bahasa adalah kenyamanan, dan pengguna yang menekan "English" harus tetap
 * mendapat halaman berbahasa Inggris meski preferensinya gagal tersimpan.
 */
export async function pilihBahasa(bahasa: Bahasa): Promise<void> {
  if (!adalahBahasa(bahasa)) return;

  (await cookies()).set(NAMA_COOKIE_BAHASA, bahasa, {
    path: "/",
    maxAge: SETAHUN,
    sameSite: "lax",
  });

  try {
    const sesi = await sesiSaatIni();
    if (sesi) {
      await prisma.pengguna.update({ where: { id: sesi.id }, data: { bahasa } });
    }
  } catch {
    // Cookie sudah terpasang; preferensi lintas perangkat saja yang tertinggal.
  }
}
