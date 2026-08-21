import "server-only";
import { redirect } from "next/navigation";
import { sesiSaatIni, type PenggunaSesi } from "@/lib/sesi";
import type { Peran } from "@/generated/prisma";

/**
 * Otorisasi berbasis peran DAN cakupan prodi.
 * Peran tanpa prodi (prodiId null) berarti cakupan institusi.
 */

export const LABEL_PERAN: Record<Peran, string> = {
  ADMIN: "Administrator",
  KAPRODI: "Ketua Program Studi",
  GPM: "Penjaminan Mutu",
  KOORDINATOR_MK: "Koordinator Mata Kuliah",
  DOSEN: "Dosen",
  MAHASISWA: "Mahasiswa",
  ASESOR: "Asesor",
};

export function punyaPeran(sesi: PenggunaSesi | null, ...peran: Peran[]): boolean {
  if (!sesi) return false;
  return peran.some((p) => sesi.daftarPeran.includes(p));
}

/** ADMIN dan GPM bercakupan institusi, sehingga berlaku untuk semua prodi. */
export function punyaPeranDiProdi(
  sesi: PenggunaSesi | null,
  prodiId: string,
  ...peran: Peran[]
): boolean {
  if (!sesi) return false;
  return sesi.penugasan.some(
    (p) => peran.includes(p.peran) && (p.prodiId === null || p.prodiId === prodiId),
  );
}

export function adalahAdmin(sesi: PenggunaSesi | null): boolean {
  return punyaPeran(sesi, "ADMIN");
}

/** Prodi yang boleh dikelola pengguna. null = semua prodi. */
export function cakupanProdi(sesi: PenggunaSesi | null): string[] | null {
  if (!sesi) return [];
  if (punyaPeran(sesi, "ADMIN", "GPM", "ASESOR")) return null;
  const daftar = sesi.penugasan
    .map((p) => p.prodiId)
    .filter((id): id is string => id !== null);
  return [...new Set(daftar)];
}

export async function wajibMasuk(): Promise<PenggunaSesi> {
  const sesi = await sesiSaatIni();
  if (!sesi) redirect("/masuk");
  return sesi;
}

/** Pengguna yang belum diverifikasi diarahkan ke halaman tunggu. */
export async function wajibAktif(): Promise<PenggunaSesi> {
  const sesi = await wajibMasuk();
  if (sesi.status !== "AKTIF") redirect("/menunggu-verifikasi");
  return sesi;
}

export async function wajibPeran(...peran: Peran[]): Promise<PenggunaSesi> {
  const sesi = await wajibAktif();
  if (!punyaPeran(sesi, ...peran)) redirect("/dashboard?galat=akses-ditolak");
  return sesi;
}
