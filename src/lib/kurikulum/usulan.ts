import "server-only";
import { prisma } from "@/lib/prisma";
import type { KurikulumInput } from "@/domain/kurikulum/tipe";
import * as inti from "./usulan-inti";

/**
 * Pembungkus Usulan Revisi Kurikulum untuk aplikasi.
 *
 * Seluruh isinya ada di `usulan-inti.ts`, yang menerima klien Prisma sebagai
 * parameter agar dapat diuji terhadap Postgres tertanam. Berkas ini hanya
 * mengikatnya ke klien aplikasi, sekaligus menjaga `server-only` tetap
 * melindungi jalur yang dipakai halaman dan aksi.
 */

export type {
  DampakUsulan,
  RpkpsTerdampak,
  RujukanPensiun,
  HasilPenerapan,
  UsulanLengkap,
} from "./usulan-inti";
export { SERTAKAN_USULAN, keUsulanInput, keButirInput } from "./usulan-inti";

export async function muatUsulan(id: string) {
  return inti.muatUsulan(prisma, id);
}

export async function muatKurikulumInput(kurikulumId: string): Promise<KurikulumInput | null> {
  return inti.muatKurikulumInput(prisma, kurikulumId);
}

export async function dampakUsulan(u: inti.UsulanLengkap) {
  return inti.dampakUsulan(prisma, u);
}

export async function taBerlakuBawaan() {
  return inti.taBerlakuBawaan(prisma);
}

export async function terapkanUsulan(
  u: inti.UsulanLengkap,
  olehId: string,
  berlakuMulaiTaId: string | null,
) {
  return inti.terapkanUsulan(prisma, u, olehId, berlakuMulaiTaId);
}
