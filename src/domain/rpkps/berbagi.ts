/**
 * Aturan tautan pratinjau bertoken — docs/06 §4.2 (tahap B5).
 *
 * Murni: tanpa Prisma, tanpa crypto, tanpa tanggal "sekarang" yang tersembunyi.
 * Yang diputuskan di sini hanya dua hal, dan keduanya adalah hal yang paling
 * mudah salah: berapa lama sebuah tautan boleh hidup, dan apakah sebuah tautan
 * masih boleh dibuka.
 *
 * Tautan ini satu-satunya jalan melihat dokumen yang BELUM disahkan tanpa
 * login. Karena itu tidak ada keadaan "berlaku selamanya": yang tidak
 * kedaluwarsa hanya menunggu bocor.
 */

/** Batas atas umur tautan. Lebih panjang dari satu semester tidak ada gunanya. */
export const MAKS_HARI_BERBAGI = 90;

/** Bawaan: cukup untuk satu putaran tinjauan mitra, cukup pendek untuk lupa. */
export const BAWAAN_HARI_BERBAGI = 14;

export const MIN_HARI_BERBAGI = 1;

export type StatusTautan = "AKTIF" | "KEDALUWARSA" | "DICABUT";

const HARI = 86_400_000;

/**
 * Umur yang diminta, dijepit ke rentang yang sah.
 *
 * Dijepit, bukan ditolak: nilainya datang dari borang, dan borang yang menolak
 * "120" tanpa menawarkan apa pun hanya memaksa orang menebak. Yang penting
 * dijamin adalah tidak ada tautan yang hidup lebih dari batas atas.
 */
export function jepitHari(hari: number): number {
  if (!Number.isFinite(hari)) return BAWAAN_HARI_BERBAGI;
  return Math.min(MAKS_HARI_BERBAGI, Math.max(MIN_HARI_BERBAGI, Math.trunc(hari)));
}

/** Tanggal kedaluwarsa sebuah tautan yang dibuat sekarang. */
export function hitungKedaluwarsa(hari: number, sekarang: Date): Date {
  return new Date(sekarang.getTime() + jepitHari(hari) * HARI);
}

/**
 * Keadaan sebuah tautan.
 *
 * Pencabutan menang atas kedaluwarsa: keduanya menutup pintu, tetapi yang
 * pertama adalah keputusan seseorang dan itulah yang perlu terbaca di daftar.
 */
export function statusTautan(
  t: { kedaluwarsa: Date; dicabutPada: Date | null },
  sekarang: Date,
): StatusTautan {
  if (t.dicabutPada !== null) return "DICABUT";
  return t.kedaluwarsa.getTime() <= sekarang.getTime() ? "KEDALUWARSA" : "AKTIF";
}

/** Hanya tautan AKTIF yang membuka pintu. */
export function bolehDibuka(
  t: { kedaluwarsa: Date; dicabutPada: Date | null },
  sekarang: Date,
): boolean {
  return statusTautan(t, sekarang) === "AKTIF";
}

/**
 * Sisa umur dalam hari, untuk ditampilkan di panel berbagi. Nol berarti
 * berakhir hari ini; negatif tidak pernah dikembalikan — yang sudah lewat
 * berstatus KEDALUWARSA, dan sisa harinya tidak lagi menarik.
 */
export function sisaHari(kedaluwarsa: Date, sekarang: Date): number {
  return Math.max(0, Math.ceil((kedaluwarsa.getTime() - sekarang.getTime()) / HARI));
}
