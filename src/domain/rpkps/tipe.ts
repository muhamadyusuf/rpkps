import type { KategoriWaktu } from "@/domain/beban-belajar/tipe";

/** Bentuk data RPKPS yang bebas Prisma, agar validator dapat diuji. */

export type JenisPertemuan = "EFEKTIF" | "UTS" | "UAS";

/**
 * Panjang minimum catatan revisi.
 *
 * Mengembalikan RPKPS tanpa menyebutkan apa yang salah memaksa dosen menebak,
 * dan menghabiskan satu putaran bolak-balik untuk sesuatu yang bisa ditulis
 * dalam satu kalimat. Angkanya sengaja rendah — cukup untuk menolak "revisi"
 * dan "ok", tidak cukup untuk merepotkan.
 *
 * Ditegakkan di server (aksi.ts) dan dicerminkan di tombol putusan supaya
 * pengguna tahu batasnya sebelum menekan tombol.
 */
export const MIN_CATATAN_REVISI = 10;

export interface AktivitasRpkps {
  nama: string;
  kategori: KategoriWaktu;
  menit: number;
}

export interface PertemuanRpkps {
  minggu: number;
  jenis: JenisPertemuan;
  topik: string | null;
  subtopik: string[];
  metodeNarasi: string | null;
  penilaianJenis: string | null;
  bobot: number;
  /** Kode Sub-CPMK yang dibahas pada pertemuan ini. */
  subCpmkKode: string[];
  aktivitas: AktivitasRpkps[];
  indikator: string[];
  pustakaNomor: number[];
}

export interface KomponenNilaiRpkps {
  nama: string;
  bobot: number;
}

export interface KriteriaTugasRpkps {
  nomor: number;
  indikator: string;
  bobot: number;
}

export interface TugasRpkps {
  nomor: number;
  nama: string;
  mingguMulai: number;
  mingguSelesai: number;
  bobot: number;
  deskripsi: string;
  /** Kode Sub-CPMK yang ditagih tugas ini. */
  subCpmkKode: string[];
  kriteria: KriteriaTugasRpkps[];
  jumlahLinimasa: number;
}

export interface RpkpsInput {
  mkKode: string;
  mkNama: string;
  sksTeori: number;
  sksPraktik: number;
  deskripsi: string | null;
  /** Kode CPL yang dibebankan pada mata kuliah, dari kurikulum. */
  cplKode: string[];
  /** Seluruh kode Sub-CPMK milik mata kuliah, dari kurikulum. */
  subCpmkTersedia: string[];
  pertemuan: PertemuanRpkps[];
  komponenNilai: KomponenNilaiRpkps[];
  tugas: TugasRpkps[];
  jumlahPustakaUtama: number;
  jumlahPengampu: number;
}

export type TingkatTemuan = "PEMBLOKIR" | "PERINGATAN" | "INFO";

export interface TemuanRpkps {
  kode: string;
  tingkat: TingkatTemuan;
  pesan: string;
  minggu?: number;
  saran?: string;
}
