import type { JenisButir } from "@/domain/kurikulum/usulan";
import type { StatusUsulan } from "@/generated/prisma";

/**
 * Yang tersisa di sini hanyalah keputusan RUPA dan keputusan DOMAIN.
 *
 * Teks status, jenis butir, dan jenis dasar sudah pindah ke `kamus.enum`
 * (docs/11 §4.3). Varian lencana bukan teks — ia sama di kedua bahasa — dan
 * daftar jenis di bawah menentukan bidang mana yang muncul di formulir,
 * bukan bagaimana jenisnya dieja.
 */

export const VARIAN_STATUS: Record<StatusUsulan, "default" | "secondary" | "outline" | "destructive"> = {
  DRAF: "outline",
  DIAJUKAN: "default",
  DIREVISI: "secondary",
  DISETUJUI: "default",
  DITERAPKAN: "secondary",
  DITOLAK: "destructive",
  DITARIK: "outline",
};

/** Jenis butir yang membawa rumusan baru, dipakai form dan tampilan diff. */
export const JENIS_BERUMUSAN: JenisButir[] = [
  "CPMK_BARU",
  "CPMK_RUMUSAN",
  "SUB_BARU",
  "SUB_RUMUSAN",
];

export const JENIS_BERSASARAN_SUB: JenisButir[] = [
  "SUB_BARU",
  "SUB_RUMUSAN",
  "SUB_MINGGU",
  "SUB_PENSIUN",
];
