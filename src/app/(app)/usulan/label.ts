import type { JenisButir, JenisDasar, StatusButir } from "@/domain/kurikulum/usulan";
import type { StatusUsulan } from "@/generated/prisma";

/** Satu sumber kebenaran untuk teks status dan jenis di seluruh halaman usulan. */

export const LABEL_STATUS: Record<StatusUsulan, string> = {
  DRAF: "Draf",
  DIAJUKAN: "Menunggu keputusan",
  DIREVISI: "Perlu revisi",
  DISETUJUI: "Disetujui",
  DITERAPKAN: "Diterapkan",
  DITOLAK: "Ditolak",
  DITARIK: "Ditarik",
};

export const VARIAN_STATUS: Record<StatusUsulan, "default" | "secondary" | "outline" | "destructive"> = {
  DRAF: "outline",
  DIAJUKAN: "default",
  DIREVISI: "secondary",
  DISETUJUI: "default",
  DITERAPKAN: "secondary",
  DITOLAK: "destructive",
  DITARIK: "outline",
};

export const LABEL_JENIS: Record<JenisButir, string> = {
  CPMK_BARU: "CPMK baru",
  CPMK_RUMUSAN: "Rumusan CPMK",
  CPMK_PETA_CPL: "Peta CPL",
  CPMK_PENSIUN: "Pensiunkan CPMK",
  SUB_BARU: "Sub-CPMK baru",
  SUB_RUMUSAN: "Rumusan Sub-CPMK",
  SUB_MINGGU: "Minggu disarankan",
  SUB_PENSIUN: "Pensiunkan Sub-CPMK",
  CATATAN_CPL: "Catatan CPL (di luar kewenangan)",
};

export const LABEL_STATUS_BUTIR: Record<StatusButir, string> = {
  BARU: "Belum diputuskan",
  DITERIMA: "Diterima",
  DISESUAIKAN: "Diterima dengan penyesuaian",
  DITOLAK: "Ditolak",
};

export const LABEL_DASAR: Record<JenisDasar, string> = {
  TEMUAN_VALIDATOR: "Temuan validator",
  TEMUAN_EVALUASI: "Temuan evaluasi ketercapaian",
  SINYAL_INDUSTRI: "Sinyal industri",
  MASUKAN_DUDI: "Masukan DUDI",
  TRACER: "Tracer study",
  CATATAN_DOSEN: "Catatan dosen",
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
