/**
 * Perhitungan halaman daftar.
 *
 * Murni dan tanpa Prisma: daftar internal — RPKPS, pengguna, usulan — dahulu
 * memuat SELURUH baris sekaligus. Untuk satu prodi itu tidak terasa; bagi
 * ADMIN, GPM, dan asesor yang bercakupan institusi, jumlah barisnya tumbuh
 * seiring umur aplikasi dan tidak pernah menyusut.
 *
 * Nomor halaman datang dari alamat, artinya dari siapa saja. Karena itu setiap
 * nilai dijepit di sini — bukan dipercaya — supaya `skip` yang dikirim ke
 * database tidak pernah negatif atau raksasa.
 */

export const UKURAN_HALAMAN = 25;

/** Panjang kata kunci yang masih masuk akal untuk sebuah kolom `contains`. */
const MAKS_KATA = 100;

export type Halaman = {
  /** Nomor halaman setelah dijepit; selalu ≥ 1 dan ≤ totalHalaman. */
  halaman: number;
  totalHalaman: number;
  lewati: number;
  ambil: number;
  /** Nomor baris pertama dan terakhir pada halaman ini, berbasis 1. */
  dari: number;
  sampai: number;
  total: number;
};

export function hitungHalaman(
  total: number,
  halamanDiminta: number,
  ukuran: number = UKURAN_HALAMAN,
): Halaman {
  const aman = Math.max(1, Math.floor(ukuran));
  const totalHalaman = Math.max(1, Math.ceil(total / aman));
  const halaman = Math.min(Math.max(1, Math.floor(halamanDiminta) || 1), totalHalaman);
  const lewati = (halaman - 1) * aman;

  return {
    halaman,
    totalHalaman,
    lewati,
    ambil: aman,
    dari: total === 0 ? 0 : lewati + 1,
    sampai: Math.min(total, lewati + aman),
    total,
  };
}

/** Nomor halaman dari query string, apa pun bentuk yang dikirim. */
export function bacaHalaman(nilai: string | string[] | undefined): number {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  const angka = Number.parseInt(teks ?? "", 10);
  return Number.isFinite(angka) && angka > 0 ? angka : 1;
}

/** Kata kunci dari query string: dirapikan, dipotong, dan tidak pernah null. */
export function bacaKata(nilai: string | string[] | undefined): string {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  return (teks ?? "").trim().replace(/\s+/g, " ").slice(0, MAKS_KATA);
}

/**
 * Alamat halaman lain dengan seluruh saringan lain dipertahankan.
 *
 * Menyusun ulang query string, bukan menambahkan `?hal=` di belakang: tanpa
 * itu, berpindah halaman dua kali menghasilkan alamat bertumpuk dan pencarian
 * yang sedang aktif hilang di tengah jalan.
 */
export function tautanHalaman(
  basis: string,
  params: Record<string, string | undefined>,
  halaman: number,
): string {
  const q = new URLSearchParams();
  for (const [kunci, nilai] of Object.entries(params)) {
    if (nilai !== undefined && nilai !== "") q.set(kunci, nilai);
  }
  if (halaman > 1) q.set("hal", String(halaman));
  else q.delete("hal");
  const teks = q.toString();
  return teks ? `${basis}?${teks}` : basis;
}
