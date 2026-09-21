import { labelDokumen } from "@/lib/dokumen/label";
import type { Bahasa } from "@/kamus";

/**
 * Kop lembaga — lambang, nama, dan kontak yang tercetak di kepala berkas.
 * Acuan: docs/21 §2.5 dan §2.9.
 *
 * **Kop dirakit SEKALI di sini dan dipakai ketiga pencetak** (RPKPS, buku
 * ajar, portofolio kelas). Menyalinnya tiga kali berarti ketiganya menyimpang
 * pelan-pelan — persis yang sudah dicegah `rakit-naskah.ts` untuk isi
 * dokumen, dan kegagalannya sama tidak terlihatnya: tidak ada galat, hanya
 * tiga berkas resmi dari satu prodi dengan tiga alamat yang berbeda.
 *
 * Berkas ini MURNI — tanpa Prisma, tanpa `server-only`. Pembacaan basis
 * datanya ada di `muat-kop.ts`. Pemisahan itu bukan selera: bentuk kop dan
 * perakitan baris kontaknya dipakai pencetak DOCX, yang diuji di luar Next,
 * dan satu `import "server-only"` yang ikut terbawa membuat seluruh uji
 * pencetak gagal dengan galat yang tidak menyebut sebabnya.
 *
 * ## Kop TIDAK PERNAH dibekukan
 *
 * Identitas prodi tidak ada di `proyeksiIsi()` maupun `proyeksiIsiEn()`, dan
 * tidak boleh ditambahkan ke sana: proyeksi adalah dasar sidik SHA-256, dan
 * menambah apa pun ke sana menggeser sidik SELURUH RPKPS yang sudah terbit.
 *
 * Konsekuensinya justru yang diinginkan. Prodi pindah gedung atau berganti
 * nomor telepon, lalu sebuah RPKPS terbit dicetak ulang: badan dokumennya
 * tetap datang dari salinan beku, kopnya yang baru. Isinya tidak berubah,
 * sidiknya tidak bergeser, tanda tangannya tetap sah. Kop adalah kertasnya,
 * bukan naskahnya.
 */

export interface LogoKop {
  /** Alamat untuk `<img>` di layar, sudah membawa penanda versi. */
  url: string;
  lebar: number;
  tinggi: number;
  /**
   * Bita gambarnya. HANYA terisi pada kop yang dimuat untuk PENCETAK
   * (`muatKopCetak`): halaman pratinjau merender lewat `<img>` dan tidak
   * perlu menarik dua kali setengah megabita hanya untuk membuangnya.
   */
  bita?: Buffer;
}

export interface KopLembaga {
  institusi: string;
  /** Sudah lengkap: "Program Studi Teknologi Informasi (S1)". */
  prodi: string;
  alamat: string | null;
  telepon: string | null;
  surel: string | null;
  situs: string | null;
  logoInstitusi: LogoKop | null;
  logoProdi: LogoKop | null;
}

/**
 * Baris kontak sebagai SATU kalimat, sudah dirangkai.
 *
 * Yang kosong dihilangkan, bukan dicetak sebagai "-": kop yang berisi
 * "Telp. - · Email: -" mengatakan lebih sedikit daripada kop yang diam.
 */
export function barisKontak(kop: KopLembaga, bahasa: Bahasa): string | null {
  const L = labelDokumen(bahasa);
  const bagian = [
    kop.alamat,
    kop.telepon ? `${L.kopTelepon}${kop.telepon}` : null,
    kop.surel,
    kop.situs?.replace(/^https?:\/\//, ""),
  ].filter((b): b is string => !!b && b.trim().length > 0);
  return bagian.length > 0 ? bagian.join(" · ") : null;
}
