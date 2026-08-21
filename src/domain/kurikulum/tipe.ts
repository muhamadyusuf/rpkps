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

export interface CplInput {
  id?: string;
  kode: string;
  deskripsi: string;
  tingkatKkni?: number | null;
}

export interface KurikulumInput {
  nama: string;
  tahun: number;
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
