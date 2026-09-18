import type { Peran } from "@/generated/prisma";

/** Hanya data peran yang dibutuhkan untuk memutuskan wewenang. */
export type SesiOtorisasi = {
  daftarPeran: readonly Peran[];
  penugasan: readonly { peran: Peran; prodiId: string | null }[];
};

export function punyaPeran(sesi: SesiOtorisasi | null, ...peran: Peran[]): boolean {
  if (!sesi) return false;
  return peran.some((p) => sesi.daftarPeran.includes(p));
}

/** Penugasan tanpa prodi berlaku untuk seluruh institusi. */
export function punyaPeranDiProdi(
  sesi: SesiOtorisasi | null,
  prodiId: string,
  ...peran: Peran[]
): boolean {
  if (!sesi) return false;
  return sesi.penugasan.some(
    (p) => peran.includes(p.peran) && (p.prodiId === null || p.prodiId === prodiId),
  );
}

export function adalahAdmin(sesi: SesiOtorisasi | null): boolean {
  return punyaPeran(sesi, "ADMIN");
}

/** Cakupan dasar penugasan pengguna. null = seluruh prodi. */
export function cakupanProdi(sesi: SesiOtorisasi | null): string[] | null {
  if (!sesi) return [];
  if (punyaPeran(sesi, "ADMIN", "GPM", "ASESOR")) return null;
  const daftar = sesi.penugasan
    .map((p) => p.prodiId)
    .filter((id): id is string => id !== null);
  return [...new Set(daftar)];
}

/**
 * Dosen boleh membaca kurikulum dan memilih mata kuliah lintas prodi untuk
 * menyusun RPKPS. Cakupan ini tidak memberi hak mengelola kurikulum maupun
 * membuka RPKPS yang tidak diampu; kedua wewenang itu diperiksa tersendiri.
 */
export function cakupanKurikulum(sesi: SesiOtorisasi | null): string[] | null {
  if (punyaPeran(sesi, "DOSEN", "KOORDINATOR_MK", "KAPRODI")) return null;
  return cakupanProdi(sesi);
}

export function bolehBuatRpkpsDiProdi(sesi: SesiOtorisasi | null, prodiId: string): boolean {
  if (!punyaPeran(sesi, "ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN")) return false;
  const cakupan = cakupanKurikulum(sesi);
  return cakupan === null || cakupan.includes(prodiId);
}

/**
 * Jabatan Kaprodi harus berlaku pada prodi sasaran. Peran dosen atau GPM
 * yang dipegang bersamaan tidak memperluas jabatan Kaprodi ke prodi lain.
 */
export function bolehKelolaKurikulum(sesi: SesiOtorisasi | null, prodiId: string): boolean {
  return adalahAdmin(sesi) || punyaPeranDiProdi(sesi, prodiId, "KAPRODI");
}
