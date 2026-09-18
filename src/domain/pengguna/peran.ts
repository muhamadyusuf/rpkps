import type { Peran } from "@/generated/prisma";

/** Peran bercakupan institusi (tanpa prodi). Dipakai formulir tambah dan impor. */
export const PERAN_INSTITUSI: Peran[] = ["ADMIN", "GPM", "ASESOR"];

export function peranButuhProdi(peran: Peran): boolean {
  return !PERAN_INSTITUSI.includes(peran);
}
