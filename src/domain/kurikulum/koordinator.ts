import { riwayat, type DataRiwayat } from "@/domain/rpkps/riwayat";
/**
 * Penugasan dosen koordinator mata kuliah — bagian yang tidak menyentuh
 * database (docs/13-penugasan-koordinator-mk.md).
 *
 * Tiga keputusan hidup di sini karena ketiganya mudah ditulis nyaris benar di
 * sisi pemanggil, dan salahnya tidak bergejala:
 *
 *   1. Siapa yang SAH menjadi koordinator.
 *   2. Apa yang terjadi pada RPKPS yang sudah ada saat penugasan berubah —
 *      siapa turun, siapa naik, siapa perlu ditambahkan lebih dulu.
 *   3. Siapa yang memegang RPKPS yang baru dibuat: pemegang penugasan, bukan
 *      orang yang kebetulan menekan tombolnya.
 */

/**
 * Peran yang boleh ditugasi memegang mata kuliah. Sama persis dengan calon
 * pengampu di docs/06 §3.2 — penugasan tidak boleh lebih longgar daripada
 * kepengampuan yang lahir darinya.
 */
export const PERAN_CALON_KOORDINATOR = ["DOSEN", "KOORDINATOR_MK", "KAPRODI"] as const;

export type CalonKoordinator = {
  nama: string;
  status: "AKTIF" | "NONAKTIF" | "MENUNGGU_VERIFIKASI";
  /** Seluruh peran yang dipegang calon, tanpa memandang prodinya. */
  peran: readonly string[];
};

export type Kelayakan = { boleh: boolean; alasan: string | null };

/**
 * Menimbang seorang calon.
 *
 * Prodi TIDAK diperiksa di sini. MK wajib umum, MK layanan, dan dosen tamu
 * dari prodi tetangga itu nyata; yang dibatasi cakupan prodi adalah SIAPA YANG
 * MENETAPKAN (Kaprodi prodi itu), bukan siapa yang ditetapkan.
 */
export function periksaCalonKoordinator(calon: CalonKoordinator): Kelayakan {
  if (calon.status !== "AKTIF") {
    return { boleh: false, alasan: `${calon.nama} belum berstatus aktif.` };
  }
  const daftar: readonly string[] = PERAN_CALON_KOORDINATOR;
  if (!calon.peran.some((p) => daftar.includes(p))) {
    return { boleh: false, alasan: `${calon.nama} tidak memegang peran dosen.` };
  }
  return { boleh: true, alasan: null };
}

// ─────────────────────────────────────────────────────────────
// SINKRONISASI DENGAN RPKPS YANG SUDAH ADA — docs/13 §2.3
// ─────────────────────────────────────────────────────────────

export type PengampuRpkps = {
  penggunaId: string;
  peran: "KOORDINATOR" | "ANGGOTA";
  nama: string;
};

export type RencanaSerahTerima = {
  /** Sudah memegang dokumen ini; tidak ada yang perlu ditulis. */
  sudahKoordinator: boolean;
  /** Belum terdaftar sebagai pengampu sama sekali. */
  perluDitambahkan: boolean;
  /**
   * Nama koordinator lama yang turun menjadi ANGGOTA. Sengaja TIDAK dilepas
   * dari tim: ia tetap ikut mengampu sampai ada yang melepasnya (docs/06 §3.2).
   */
  namaDiturunkan: string[];
};

export function rencanakanSerahTerima(
  pengampu: readonly PengampuRpkps[],
  penggunaId: string,
): RencanaSerahTerima {
  const baris = pengampu.find((p) => p.penggunaId === penggunaId);
  return {
    sudahKoordinator: baris?.peran === "KOORDINATOR",
    perluDitambahkan: baris === undefined,
    namaDiturunkan: pengampu
      .filter((p) => p.peran === "KOORDINATOR" && p.penggunaId !== penggunaId)
      .map((p) => p.nama),
  };
}

/** Kalimat untuk `rpkps_riwayat`. Menyebut kedua pihak, bukan hanya yang naik. */
export function peristiwaSerahTerima(
  namaBaru: string,
  namaDiturunkan: readonly string[],
): DataRiwayat {
  return namaDiturunkan.length > 0
    ? riwayat("KOORDINASI_DIALIHKAN_PENUGASAN", {
        dari: namaDiturunkan.join(", "),
        kepada: namaBaru,
      })
    : riwayat("KOORDINASI_DISERAHKAN_PENUGASAN", { kepada: namaBaru });
}

// ─────────────────────────────────────────────────────────────
// RPKPS YANG BELUM ADA — docs/13 §2.3
// ─────────────────────────────────────────────────────────────

export type BarisPengampuAwal = {
  penggunaId: string;
  peran: "KOORDINATOR" | "ANGGOTA";
  urutan: number;
};

/**
 * Tim pengampu sebuah RPKPS yang baru dibuat.
 *
 * Sebelum docs/13 baris ini berbunyi "pembuatnya menjadi KOORDINATOR", titik.
 * Akibatnya staf prodi yang membantu menyiapkan sepuluh dokumen menjadi
 * penanggung jawab kesepuluhnya. Bila mata kuliah dan tahun akademik itu sudah
 * punya penugasan, pemegang penugasan itulah koordinatornya — dan pembuatnya
 * tetap masuk tim sebagai ANGGOTA supaya ia dapat menyelesaikan apa yang baru
 * saja ia mulai.
 */
export function susunPengampuAwal(
  pembuatId: string,
  koordinatorTertugas: string | null,
): BarisPengampuAwal[] {
  if (koordinatorTertugas === null || koordinatorTertugas === pembuatId) {
    return [{ penggunaId: pembuatId, peran: "KOORDINATOR", urutan: 0 }];
  }
  return [
    { penggunaId: koordinatorTertugas, peran: "KOORDINATOR", urutan: 0 },
    { penggunaId: pembuatId, peran: "ANGGOTA", urutan: 1 },
  ];
}
