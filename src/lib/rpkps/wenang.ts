import "server-only";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import type { PenggunaSesi } from "@/lib/sesi";
import type { PeranPengampu } from "@/generated/prisma";

/**
 * Satu-satunya tempat wewenang atas SEBUAH RPKPS diputuskan.
 *
 * Sebelumnya aturan ini disalin di enam berkas aksi dengan bentuk
 * `dalamCakupan && (pengampu || peranPengelola)`. Konjungsi itu membuat
 * penunjukan pengampu lintas prodi tidak berarti apa-apa: dosen ditambahkan,
 * lalu ditolak halaman detail yang memeriksa cakupan prodi sendiri.
 *
 * Aturan sekarang — lihat docs/06 §3.4, keputusan K2:
 *
 *   boleh = pengampu                                   (penunjukan eksplisit)
 *         || (dalamCakupan && ADMIN|KAPRODI|GPM)       (wewenang jabatan)
 *
 * Kepengampuan adalah JALUR AKSES TERSENDIRI, bukan tambahan di atas cakupan
 * prodi: ditunjuk sebagai pengampu berarti boleh menyunting RPKPS itu, dan
 * hanya RPKPS itu. Cakupan prodi tetap mengatur segala yang lain — daftar
 * kurikulum, usulan revisi, agregasi evaluasi prodi.
 */

export type BarisPengampu = { penggunaId: string; peran?: PeranPengampu };

export type SasaranWenang = {
  mataKuliah: { kurikulum: { prodiId: string } };
  pengampu: readonly BarisPengampu[];
};

export type Wenang = {
  /** Terdaftar di `rpkps_pengampu`, peran apa pun. */
  pengampu: boolean;
  /** Pengampu berperan KOORDINATOR — pemegang tanggung jawab dokumen. */
  koordinator: boolean;
  /** Prodi RPKPS ini termasuk cakupan penugasan pengguna. */
  dalamCakupan: boolean;
  /** ADMIN/KAPRODI/GPM yang cakupan prodinya memuat RPKPS ini. */
  pengelola: boolean;
  /**
   * Boleh MEMBUKA. Lebih longgar daripada `boleh`: seluruh dosen satu prodi
   * boleh membaca RPKPS rekannya — itu perilaku yang sudah berjalan dan bukan
   * bagian dari perubahan ini.
   */
  bolehLihat: boolean;
  /** Boleh MENYUNTING RPKPS ini. */
  boleh: boolean;
};

/** Menimbang wewenang atas RPKPS yang sudah dimuat pemanggil. */
export function wenangAtasRpkps(
  sesi: PenggunaSesi | null,
  rpkps: SasaranWenang,
): Wenang {
  if (!sesi) {
    return {
      pengampu: false,
      koordinator: false,
      dalamCakupan: false,
      pengelola: false,
      bolehLihat: false,
      boleh: false,
    };
  }

  const baris = rpkps.pengampu.find((p) => p.penggunaId === sesi.id);
  const pengampu = baris !== undefined;
  const koordinator = baris?.peran === "KOORDINATOR";

  const cakupan = cakupanProdi(sesi);
  const dalamCakupan =
    cakupan === null || cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId);
  const pengelola = dalamCakupan && punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM");

  return {
    pengampu,
    koordinator,
    dalamCakupan,
    pengelola,
    bolehLihat: dalamCakupan || pengampu,
    boleh: pengampu || pengelola,
  };
}

export type WenangRpkps = Wenang & {
  sesi: PenggunaSesi;
  prodiId: string | null;
  status: import("@/generated/prisma").StatusRpkps | null;
};

/**
 * Memuat RPKPS seperlunya lalu menimbang wewenang. Dipakai server action yang
 * hanya memegang `rpkpsId`.
 */
export async function wenangRpkps(rpkpsId: string): Promise<WenangRpkps> {
  const sesi = await wajibAktif();
  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      status: true,
      mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } },
      pengampu: { select: { penggunaId: true, peran: true } },
    },
  });

  if (!rpkps) {
    return {
      sesi,
      prodiId: null,
      status: null,
      pengampu: false,
      koordinator: false,
      dalamCakupan: false,
      pengelola: false,
      bolehLihat: false,
      boleh: false,
    };
  }

  return {
    sesi,
    prodiId: rpkps.mataKuliah.kurikulum.prodiId,
    status: rpkps.status,
    ...wenangAtasRpkps(sesi, rpkps),
  };
}

/**
 * Penyaring daftar RPKPS: yang berada dalam cakupan prodi, DITAMBAH yang
 * pengguna ampu sendiri walau di luar cakupan itu. Tanpa cabang kedua, dosen
 * yang ditunjuk sebagai pengampu lintas prodi tidak akan pernah melihat
 * RPKPS-nya di daftar — hanya bisa membukanya lewat tautan langsung.
 */
export function saringDaftarRpkps(sesi: PenggunaSesi) {
  const cakupan = cakupanProdi(sesi);
  if (cakupan === null) return {};
  return {
    OR: [
      { mataKuliah: { kurikulum: { prodiId: { in: cakupan } } } },
      { pengampu: { some: { penggunaId: sesi.id } } },
    ],
  };
}
