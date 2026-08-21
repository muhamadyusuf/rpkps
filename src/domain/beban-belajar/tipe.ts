/**
 * Tipe untuk mesin hitung beban belajar.
 * Acuan: docs/03-kebijakan-beban-belajar.md
 *
 * Modul ini murni — tidak menyentuh database, Prisma, maupun React —
 * supaya dapat diuji sebagai fungsi biasa dan dipakai ulang di sisi
 * klien maupun server.
 */

export type BentukPembelajaran =
  | "KULIAH"
  | "RESPONSI"
  | "TUTORIAL"
  | "SEMINAR"
  | "PRAKTIKUM"
  | "PRAKTIK_STUDIO"
  | "PRAKTIK_BENGKEL"
  | "PRAKTIK_LAPANGAN"
  | "PENELITIAN"
  | "PKM"
  | "KKN";

/** TM = tatap muka · PT = penugasan terstruktur · BM = belajar mandiri */
export type KategoriWaktu = "TM" | "PT" | "BM";

export interface MenitPerSks {
  tm: number;
  pt: number;
  bm: number;
}

export interface BentukKebijakan extends MenitPerSks {
  bentuk: BentukPembelajaran;
  /** TM butuh slot jadwal (ruang/lab), bukan waktu mandiri mahasiswa. */
  tmTerjadwal: boolean;
  /** Butuh ruang khusus: laboratorium, studio, bengkel. */
  butuhRuangKhusus: boolean;
}

export interface Kebijakan {
  mingguPerSemester: number;
  pertemuanEfektifTeori: number;
  pertemuanEfektifPraktik: number;
  hitungMingguUjian: boolean;
  menitTmPerUjian: number;
  jamPerSksPerSemester: number;
  toleransiSemesterPersen: number;
  toleransiPertemuanPersen: number;
  bentuk: BentukKebijakan[];
}

export interface SpesifikasiMataKuliah {
  kode?: string;
  nama?: string;
  sksTeori: number;
  sksPraktik: number;
  bentukTeori: BentukPembelajaran;
  bentukPraktik: BentukPembelajaran;
}

export interface Pagu {
  tm: number;
  pt: number;
  bm: number;
  total: number;
  /** Bagian dari TM yang menuntut slot jadwal. */
  terjadwal: number;
  /** Bagian dari TM yang menuntut ruang khusus (lab/studio/bengkel). */
  ruangKhusus: number;
}

export type JenisMinggu = "EFEKTIF" | "UJIAN";

export interface RencanaMinggu {
  minggu: number;
  jenis: JenisMinggu;
  adaTeori: boolean;
  adaPraktik: boolean;
  pagu: Pagu;
}

export interface RencanaSemester {
  mk: SpesifikasiMataKuliah;
  sksTotal: number;
  minggu: RencanaMinggu[];
  paguMingguEfektif: Pagu;
  /** Total menit seluruh semester menurut rencana. */
  totalMenit: number;
  /** Target menit dari invarian 45 jam/sks. */
  targetMenit: number;
  totalJam: number;
  jamPerSks: number;
  /** Selisih total terhadap target, dalam menit. Positif = kelebihan. */
  selisihMenit: number;
  selisihPersen: number;
}

export type TingkatTemuan = "PEMBLOKIR" | "PERINGATAN" | "INFO";

export interface TemuanValidasi {
  kode: string;
  lapis: 1 | 2 | 3 | 4;
  tingkat: TingkatTemuan;
  pesan: string;
  minggu?: number;
  detail?: Record<string, number | string | boolean>;
}

export interface Aktivitas {
  nama?: string;
  kategori: KategoriWaktu;
  menit: number;
}
