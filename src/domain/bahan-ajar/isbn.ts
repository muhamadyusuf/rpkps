/**
 * Pemeriksaan nomor ISBN.
 *
 * Ada di sini, bukan di skema Zod, karena alasannya bukan bentuk masukan
 * melainkan aturan penerbitan: nomor yang salah ketik akan tercetak di halaman
 * hak cipta dan ikut beredar bersama bukunya. Digit terakhir sebuah ISBN
 * adalah digit periksa, jadi salah ketik satu angka DAPAT ditangkap di sini —
 * itulah gunanya memeriksa lebih dari sekadar "13 angka".
 *
 * Yang TIDAK dilakukan: memastikan nomornya benar-benar terdaftar. Itu hanya
 * dapat dijawab Perpusnas, dan aplikasi tidak menjanjikan apa yang tidak dapat
 * ditepatinya.
 */

/** Membuang tanda hubung, spasi, dan tanda pisah lain. */
export function rapikanIsbn(nilai: string): string {
  return nilai.replace(/[\s\u2010-\u2015\u2212-]/g, "").toUpperCase();
}

export function isbnSah(nilai: string | null | undefined): boolean {
  if (!nilai) return false;
  const bersih = rapikanIsbn(nilai);
  if (bersih.length === 13) return sah13(bersih);
  if (bersih.length === 10) return sah10(bersih);
  return false;
}

/** ISBN-13: jumlah berbobot 1-3 berselang-seling, habis dibagi 10. */
function sah13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  // Awalan EAN yang dialokasikan untuk buku. 979 dipakai Indonesia.
  if (!isbn.startsWith("978") && !isbn.startsWith("979")) return false;

  let jumlah = 0;
  for (let i = 0; i < 13; i++) {
    jumlah += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return jumlah % 10 === 0;
}

/** ISBN-10: jumlah berbobot 10..1, habis dibagi 11. Digit periksa boleh X. */
function sah10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;

  let jumlah = 0;
  for (let i = 0; i < 9; i++) jumlah += Number(isbn[i]) * (10 - i);
  jumlah += isbn[9] === "X" ? 10 : Number(isbn[9]);
  return jumlah % 11 === 0;
}
