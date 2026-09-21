import "server-only";
import { redirect } from "next/navigation";
import { sesiSaatIni, type PenggunaSesi } from "@/lib/sesi";
import { jalurAktif } from "@/lib/bahasa/server";
import type { Peran } from "@/generated/prisma";
import { punyaPeran } from "@/domain/otorisasi";

/**
 * Pemeriksaan sesi tetap di server; keputusan peran dan cakupan murni hidup
 * di domain agar dapat diuji tanpa cookie, Firebase, atau basis data.
 */
export {
  punyaPeran,
  punyaPeranDiProdi,
  adalahAdmin,
  cakupanProdi,
  cakupanKurikulum,
  bolehBuatRpkpsDiProdi,
  bolehKelolaKurikulum,
  bolehSuntingIdentitasProdi,
} from "@/domain/otorisasi";

export async function wajibMasuk(): Promise<PenggunaSesi> {
  const sesi = await sesiSaatIni();
  if (!sesi) redirect(await jalurAktif("/masuk"));
  return sesi;
}

/** Pengguna yang belum diverifikasi diarahkan ke halaman tunggu. */
export async function wajibAktif(): Promise<PenggunaSesi> {
  const sesi = await wajibMasuk();
  if (sesi.status !== "AKTIF") redirect(await jalurAktif("/menunggu-verifikasi"));
  return sesi;
}

export async function wajibPeran(...peran: Peran[]): Promise<PenggunaSesi> {
  const sesi = await wajibAktif();
  if (!punyaPeran(sesi, ...peran)) redirect(await jalurAktif("/dashboard?galat=akses-ditolak"));
  return sesi;
}
