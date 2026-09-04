import "server-only";
import { prisma } from "@/lib/prisma";
import * as inti from "./draf-inti";

/**
 * Pembungkus `server-only` yang mengikat lapisan draf usulan ke klien aplikasi.
 *
 * Intinya sengaja menerima klien sebagai parameter agar dapat diuji integrasi
 * terhadap Postgres tertanam — lihat `draf-inti.ts`. Berkas ini tidak menambah
 * satu aturan pun.
 */

export type { BahanLengkap, KonteksDraf } from "./draf-inti";

export async function rakitBahanDraf(arg: {
  kurikulumId: string;
  mataKuliahId: string | null;
  catatanDosen: string | null;
}) {
  return inti.rakitBahanDraf(prisma, arg);
}

export async function tulisButirDraf(arg: {
  usulanId: string;
  butir: Parameters<typeof inti.tulisButirDraf>[1]["butir"];
  refTemuanEvaluasi: Map<string, string>;
}) {
  return inti.tulisButirDraf(prisma, arg);
}
