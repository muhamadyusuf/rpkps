import type { ParamTemuan, TingkatTemuan } from "@/domain/rpkps/tipe";

/**
 * Tipe domain bahan ajar — docs/16.
 *
 * Murni: tanpa Prisma, tanpa React. Bentuk yang dipakai di sini adalah bentuk
 * MINIMAL yang benar-benar dibutuhkan aturannya, bukan cerminan baris
 * database; pemuat di `src/lib` yang memetakannya.
 */

export type BahasaBuku = "id" | "en";

/** Satu baris mingguan, seperlunya untuk menyusun bab. */
export interface PertemuanUntukBab {
  id: string;
  minggu: number;
  jenis: "EFEKTIF" | "UTS" | "UAS";
  topik: string | null;
  subtopik: string[];
  /** Teks indikator, urut. Menjadi tujuan pembelajaran bab. */
  indikator: string[];
  subCpmk: { kode: string; rumusan: string }[];
  /** Nomor pustaka RPKPS yang sudah ditautkan ke minggu ini. */
  nomorPustaka: number[];
}

/** Bab yang dirancang dari sebuah baris mingguan, sebelum AI menulis isinya. */
export interface RancanganBab {
  nomor: number;
  minggu: number;
  pertemuanId: string;
  judul: string;
  tujuan: string[];
  subtopik: string[];
  /** Sidik rencana minggu saat bab dirancang. Lihat `sidik-sumber.ts`. */
  sidikSumber: string;
}

export interface KerangkaBuku {
  bab: RancanganBab[];
  /**
   * Minggu efektif yang DILEWATI beserta alasannya. Dilaporkan, tidak
   * dibuang diam-diam: minggu tanpa topik dan tanpa Sub-CPMK berarti RPKPS-nya
   * yang belum selesai, dan dosen harus tahu itu sebelum menyalahkan AI.
   */
  dilewati: number[];
}

// ─────────────────────────────────────────────────────────────
// PEMERIKSAAN
// ─────────────────────────────────────────────────────────────

export interface TemuanBahanAjar {
  kode: string;
  tingkat: TingkatTemuan;
  /**
   * Parameter kalimat, bukan kalimatnya. Domain menyimpan angka dan nama;
   * kalimatnya dirakit `teksTemuan` saat dibaca, dalam bahasa pembacanya.
   * Lihat docs/11 §4.1.
   */
  params?: Record<string, ParamTemuan>;
  /** Nomor bab yang bersangkutan, bila temuannya menunjuk satu bab. */
  bab?: number;
}

export interface LatihanInput {
  nomor: number;
  soal: string;
  kunci: string | null;
}

export interface BabInput {
  nomor: number;
  judul: string;
  tujuan: string[];
  uraian: string | null;
  studiKasus: string | null;
  ringkasan: string | null;
  latihan: LatihanInput[];
  jumlahSlide: number;
  /** Nomor pustaka RPKPS yang disitir bab ini. */
  sitiran: number[];
  /** Sidik saat bab disusun; dibandingkan dengan `sidikSekarang`. */
  sidikSumber: string | null;
  /** Sidik rencana minggu SAAT INI; null bila barisnya sudah tidak ada. */
  sidikSekarang: string | null;
  /** Baris mingguan asalnya masih ada. */
  punyaMinggu: boolean;
  /** Sudah pernah disunting manusia. */
  disunting: boolean;
}

export interface BukuAjarInput {
  bahasa: BahasaBuku;
  judul: string;
  penulis: string[];
  penerbit: string | null;
  tahunTerbit: number | null;
  isbn: string | null;
  prakata: string | null;
  bab: BabInput[];
  /** Nomor pustaka yang tersedia di RPKPS — penentu sitiran yang sah. */
  nomorPustakaTersedia: number[];
}

export interface HasilPeriksaBukuAjar {
  temuan: TemuanBahanAjar[];
  pemblokir: TemuanBahanAjar[];
  peringatan: TemuanBahanAjar[];
  /**
   * Tidak ada pemblokir. "Lolos" di sini berarti buku layak DIUNDUH sebagai
   * naskah terbit — bukan berarti isinya bagus. Yang menilai itu penulisnya.
   */
  lolos: boolean;
  ringkasan: {
    jumlahBab: number;
    babBerisi: number;
    babDisunting: number;
    jumlahLatihan: number;
    jumlahSlide: number;
  };
}
