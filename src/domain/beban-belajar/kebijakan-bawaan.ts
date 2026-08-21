import type { BentukKebijakan, Kebijakan } from "./tipe";

/**
 * Baris bawaan tabel kebijakan_bentuk.
 * Acuan: docs/03-kebijakan-beban-belajar.md §3.
 *
 * Semua bentuk berjumlah 170 menit per sks per minggu. Itu bukan kebetulan:
 * 170' x 16 minggu = 2.720' = 45,3 jam, yakni konstruksi dasar sistem sks.
 * Bentuk pembelajaran mengubah KOMPOSISI, bukan TOTAL.
 *
 * Praktikum dipecah 100/40/30 — bukan 170/0/0 — sesuai rekonsiliasi §1.1:
 * angka 100 adalah tatap muka terjadwal (untuk kebutuhan slot lab),
 * sisanya kegiatan terstruktur & mandiri (laporan, persiapan, pengolahan data).
 */
export const BENTUK_BAWAAN: BentukKebijakan[] = [
  { bentuk: "KULIAH", tm: 50, pt: 60, bm: 60, tmTerjadwal: true, butuhRuangKhusus: false },
  { bentuk: "RESPONSI", tm: 50, pt: 60, bm: 60, tmTerjadwal: true, butuhRuangKhusus: false },
  { bentuk: "TUTORIAL", tm: 50, pt: 60, bm: 60, tmTerjadwal: true, butuhRuangKhusus: false },
  { bentuk: "SEMINAR", tm: 100, pt: 0, bm: 70, tmTerjadwal: true, butuhRuangKhusus: false },
  { bentuk: "PRAKTIKUM", tm: 100, pt: 40, bm: 30, tmTerjadwal: true, butuhRuangKhusus: true },
  { bentuk: "PRAKTIK_STUDIO", tm: 100, pt: 40, bm: 30, tmTerjadwal: true, butuhRuangKhusus: true },
  { bentuk: "PRAKTIK_BENGKEL", tm: 100, pt: 40, bm: 30, tmTerjadwal: true, butuhRuangKhusus: true },
  { bentuk: "PRAKTIK_LAPANGAN", tm: 170, pt: 0, bm: 0, tmTerjadwal: true, butuhRuangKhusus: false },
  { bentuk: "PENELITIAN", tm: 0, pt: 170, bm: 0, tmTerjadwal: false, butuhRuangKhusus: false },
  { bentuk: "PKM", tm: 0, pt: 170, bm: 0, tmTerjadwal: false, butuhRuangKhusus: false },
  { bentuk: "KKN", tm: 0, pt: 170, bm: 0, tmTerjadwal: false, butuhRuangKhusus: false },
];

export const KEBIJAKAN_BAWAAN: Kebijakan = {
  mingguPerSemester: 16,
  pertemuanEfektifTeori: 14,
  pertemuanEfektifPraktik: 14,
  hitungMingguUjian: true,
  menitTmPerUjian: 120,
  jamPerSksPerSemester: 45,
  toleransiSemesterPersen: 5,
  toleransiPertemuanPersen: 10,
  bentuk: BENTUK_BAWAAN,
};

export const LABEL_BENTUK: Record<string, string> = {
  KULIAH: "Kuliah",
  RESPONSI: "Responsi",
  TUTORIAL: "Tutorial",
  SEMINAR: "Seminar",
  PRAKTIKUM: "Praktikum",
  PRAKTIK_STUDIO: "Praktik studio",
  PRAKTIK_BENGKEL: "Praktik bengkel",
  PRAKTIK_LAPANGAN: "Praktik lapangan / PKL",
  PENELITIAN: "Penelitian",
  PKM: "Pengabdian kepada Masyarakat",
  KKN: "KKN",
};

export const LABEL_KATEGORI: Record<string, string> = {
  TM: "Tatap muka",
  PT: "Penugasan terstruktur",
  BM: "Belajar mandiri",
};
