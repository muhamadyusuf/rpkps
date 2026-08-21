import type { LevelBloom } from "./bloom";

/** Bentuk data kurikulum yang bebas dari Prisma, agar validator dapat diuji. */

export interface SubCpmkInput {
  id?: string;
  kode: string;
  rumusan: string;
  levelBloom?: LevelBloom | null;
  /** Ditandai bila rumusannya berasal dari usulan AI yang diterima dosen. */
  sumberAi?: boolean;
}

export interface CpmkInput {
  id?: string;
  kode: string;
  rumusan: string;
  levelBloom?: LevelBloom | null;
  /** Kode CPL yang dijabarkan CPMK ini. */
  cplKode: string[];
  subCpmk: SubCpmkInput[];
  /** Ditandai bila rumusannya berasal dari usulan AI yang diterima dosen. */
  sumberAi?: boolean;
}

export interface MataKuliahInput {
  id?: string;
  kode: string;
  nama: string;
  semester: number;
  sksTeori: number;
  sksPraktik: number;
  /** Kode CPL yang dibebankan pada mata kuliah ini. */
  cplKode: string[];
  cpmk: CpmkInput[];
}

/**
 * Profil lulusan: peran atau posisi yang dijanjikan program studi kepada
 * lulusannya, mis. "PL1 — Pengembang Perangkat Lunak". Pangkal rantai
 * penelusuran OBE: PL ditopang CPL, CPL dijabarkan CPMK, CPMK ditahap
 * Sub-CPMK, Sub-CPMK dinilai.
 */
export interface ProfilLulusanInput {
  id?: string;
  kode: string;
  deskripsi: string;
}

export interface CplInput {
  id?: string;
  kode: string;
  deskripsi: string;
  tingkatKkni?: number | null;
  /**
   * Kode profil lulusan yang ditopang CPL ini. Opsional karena kurikulum lama
   * dan berkas Excel yang diunduh sebelum kolomnya ada tidak memilikinya —
   * bukan karena keterkaitannya tidak penting.
   */
  profilLulusanKode?: string[];
}

export interface KurikulumInput {
  nama: string;
  tahun: number;
  /** Opsional dengan alasan yang sama seperti `CplInput.profilLulusanKode`. */
  profilLulusan?: ProfilLulusanInput[];
  cpl: CplInput[];
  mataKuliah: MataKuliahInput[];
}

export type TingkatTemuan = "PEMBLOKIR" | "PERINGATAN" | "INFO";

export interface TemuanKurikulum {
  kode: string;
  tingkat: TingkatTemuan;
  pesan: string;
  /** Lokasi temuan, mis. { mk: "TI214", cpmk: "CPMK081" } */
  lokasi?: Record<string, string>;
  saran?: string;
}
