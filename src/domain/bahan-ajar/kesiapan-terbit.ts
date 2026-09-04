import { daftarRingkas } from "@/domain/temuan";
import { isbnSah } from "./isbn";
import { taksiranHalaman } from "./naskah";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Kesiapan terbit — docs/19 §4.
 *
 * Menjawab satu pertanyaan: apakah naskah ini dapat diserahkan ke penerbit.
 * Bukan "apakah isinya bagus" — itu tidak dapat dinilai mesin, dan yang dapat
 * menilainya hanya penulisnya sendiri.
 *
 * Murni: tanpa Prisma, tanpa React.
 */

/**
 * Batas UNESCO yang memisahkan buku dari pamflet, dan dipakai luas dalam
 * praktik penerbitan serta pengajuan ISBN. Bukan angka karangan aplikasi ini.
 */
export const HALAMAN_MINIMAL = 49;

export interface BukuKesiapan {
  judul: string;
  penulis: string[];
  penerbit: string | null;
  kotaTerbit: string | null;
  tahunTerbit: number | null;
  isbn: string | null;
  prakata: string | null;
  sinopsis: string | null;
  kataKunci: string[];
  glosarium: { istilah: string }[];
  pustaka: { nomor: number }[];
  bab: { nomor: number; adaUraian: boolean; disunting: boolean }[];
  jumlahKata: number;
  /** Usulan penyuntingan yang belum diputus dosen. */
  usulanTerbuka: number;
}

export interface HasilKesiapan {
  temuan: TemuanBahanAjar[];
  /** Tidak ada satu pun syarat yang belum terpenuhi. */
  siap: boolean;
  ringkasan: {
    taksiranHalaman: number;
    babBerisi: number;
    babDisunting: number;
    jumlahBab: number;
  };
}

export function periksaKesiapanTerbit(buku: BukuKesiapan): HasilKesiapan {
  const temuan: TemuanBahanAjar[] = [];
  const belum = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PEMBLOKIR", ...(params ? { params } : {}) });
  };
  const catat = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PERINGATAN", ...(params ? { params } : {}) });
  };

  // ── Metadata terbitan ───────────────────────────────────────────────
  const kurang: string[] = [];
  if (!buku.judul.trim()) kurang.push("judul");
  if (buku.penulis.filter((p) => p.trim()).length === 0) kurang.push("penulis");
  if (!buku.penerbit?.trim()) kurang.push("penerbit");
  if (!buku.kotaTerbit?.trim()) kurang.push("kota");
  if (!buku.tahunTerbit) kurang.push("tahun");
  if (kurang.length > 0) belum("KT-METADATA", { jumlah: kurang.length });

  /*
   * ISBN adalah PEMBLOKIR di sini, tidak seperti pada `periksaBukuAjar` yang
   * hanya menolak ISBN salah ketik. Bedanya pertanyaan yang dijawab: di sana
   * "bolehkah dicetak", di sini "bolehkah diserahkan sebagai terbitan".
   * Terbitan tanpa ISBN belum menjadi terbitan.
   */
  if (!buku.isbn?.trim()) belum("KT-ISBN");
  else if (!isbnSah(buku.isbn)) belum("KT-ISBN");

  // ── Naskah ──────────────────────────────────────────────────────────
  const halaman = taksiranHalaman(buku.jumlahKata);
  if (halaman < HALAMAN_MINIMAL) {
    belum("KT-HALAMAN", { n: HALAMAN_MINIMAL, taksiran: halaman });
  }

  const kosong = buku.bab.filter((b) => !b.adaUraian).map((b) => String(b.nomor));
  if (kosong.length > 0) {
    belum("KT-BAB-KOSONG", { jumlah: kosong.length, daftar: daftarRingkas(kosong) });
  }

  const belumDisunting = buku.bab
    .filter((b) => b.adaUraian && !b.disunting)
    .map((b) => String(b.nomor));
  if (belumDisunting.length > 0) {
    belum("KT-BELUM-DISUNTING", {
      jumlah: belumDisunting.length,
      daftar: daftarRingkas(belumDisunting),
    });
  }

  if (buku.usulanTerbuka > 0) {
    catat("KT-USULAN-TERBUKA", { jumlah: buku.usulanTerbuka });
  }

  // ── Kelengkapan ─────────────────────────────────────────────────────
  if (!buku.prakata?.trim()) belum("KT-TANPA-PRAKATA");
  if (buku.glosarium.length === 0) catat("KT-TANPA-GLOSARIUM");
  if (buku.pustaka.length === 0) belum("KT-TANPA-PUSTAKA");
  if (!buku.sinopsis?.trim() || buku.kataKunci.length === 0) belum("KT-TANPA-SINOPSIS");

  return {
    temuan,
    siap: temuan.every((t) => t.tingkat !== "PEMBLOKIR"),
    ringkasan: {
      taksiranHalaman: halaman,
      babBerisi: buku.bab.filter((b) => b.adaUraian).length,
      babDisunting: buku.bab.filter((b) => b.disunting).length,
      jumlahBab: buku.bab.length,
    },
  };
}
