/**
 * Pembantu bersama untuk temuan validator.
 *
 * Murni: tanpa Prisma, tanpa React, tanpa kalimat.
 */

/**
 * Daftar yang dipotong beserta elipsisnya — "TI214, TI310, TI402, …".
 *
 * Ini data, bukan kalimat: yang dirakit hanyalah pemisah koma dan penanda
 * "masih ada lagi", dan keduanya sama di kedua bahasa. Menaruhnya di sini
 * menghindarkan lima validator menulis ulang potongan `slice(0, 5).join(", ")`
 * yang sama, masing-masing dengan batas yang diam-diam berbeda.
 */
export function daftarRingkas(nilai: readonly string[], maks = 5): string {
  return nilai.slice(0, maks).join(", ") + (nilai.length > maks ? ", …" : "");
}
