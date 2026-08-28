import "server-only";
import { prisma } from "@/lib/prisma";
import * as inti from "./evaluasi-inti";

/**
 * Pembungkus pemuatan kelas dan evaluasi untuk aplikasi.
 *
 * Seluruh isinya ada di `evaluasi-inti.ts`, yang menerima klien Prisma sebagai
 * parameter agar dapat diuji terhadap Postgres tertanam — pola yang sama
 * dengan `src/lib/kurikulum/usulan.ts`. Berkas ini hanya mengikatnya ke klien
 * aplikasi, sekaligus menjaga `server-only` tetap melindungi jalur yang
 * dipakai halaman dan aksi.
 */

export type { KelasLengkap, KelasRpkps, KelasEvaluasi } from "./evaluasi-inti";

export async function muatKelas(kelasId: string) {
  return inti.muatKelas(prisma, kelasId);
}

export async function muatKelasRpkps(rpkpsId: string) {
  return inti.muatKelasRpkps(prisma, rpkpsId);
}

export async function muatKelasEvaluasi(kelasId: string) {
  return inti.muatKelasEvaluasi(prisma, kelasId);
}

export async function muatTemuanBelumDiverifikasi(
  mataKuliahId: string,
  kecualiKelasId: string,
) {
  return inti.muatTemuanBelumDiverifikasi(prisma, mataKuliahId, kecualiKelasId);
}

export async function muatBarisCapaian(
  prodiId: string,
  opsi: { tahunAkademikId?: string } = {},
) {
  return inti.muatBarisCapaian(prisma, prodiId, opsi);
}

export async function muatKonteksProdi(prodiId: string) {
  return inti.muatKonteksProdi(prisma, prodiId);
}
