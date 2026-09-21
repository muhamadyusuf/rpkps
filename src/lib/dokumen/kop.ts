import "server-only";
import { prisma } from "@/lib/prisma";
import { pilihTeks } from "@/lib/bahasa/teks";
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

const PILIH = {
  id: true,
  nama: true,
  namaEn: true,
  jenjang: true,
  alamat: true,
  telepon: true,
  surel: true,
  situs: true,
  logoLebar: true,
  logoTinggi: true,
  diubahPada: true,
} as const;

const PILIH_INSTITUSI = {
  id: true,
  nama: true,
  namaEn: true,
  logoLebar: true,
  logoTinggi: true,
  diubahPada: true,
} as const;

type BarisProdi = {
  id: string;
  nama: string;
  namaEn: string | null;
  jenjang: string;
  alamat: string | null;
  telepon: string | null;
  surel: string | null;
  situs: string | null;
  logoLebar: number | null;
  logoTinggi: number | null;
  diubahPada: Date;
  logo?: Uint8Array | null;
};

type BarisInstitusi = {
  id: string;
  nama: string;
  namaEn: string | null;
  logoLebar: number | null;
  logoTinggi: number | null;
  diubahPada: Date;
  logo?: Uint8Array | null;
};

function logoKop(
  jalur: string,
  baris: { logoLebar: number | null; logoTinggi: number | null; diubahPada: Date; logo?: Uint8Array | null },
): LogoKop | null {
  if (!baris.logoLebar || !baris.logoTinggi) return null;
  return {
    // Penanda versi supaya penggantian logo langsung terlihat meski rutenya
    // boleh di-cache lama.
    url: `${jalur}?v=${baris.diubahPada.getTime()}`,
    lebar: baris.logoLebar,
    tinggi: baris.logoTinggi,
    ...(baris.logo ? { bita: Buffer.from(baris.logo) } : {}),
  };
}

function rakit(
  institusi: BarisInstitusi | null,
  prodi: BarisProdi | null,
  bahasa: Bahasa,
): KopLembaga {
  const L = labelDokumen(bahasa);
  const namaProdi = prodi
    ? `${L.kopProgramStudi} ${pilihTeks(prodi.nama, prodi.namaEn, bahasa).teks} (${prodi.jenjang})`
    : "";
  return {
    institusi: institusi
      ? pilihTeks(institusi.nama, institusi.namaEn, bahasa).teks
      : L.institutTeknologiTangerangSelatan,
    prodi: namaProdi,
    alamat: prodi?.alamat ?? null,
    telepon: prodi?.telepon ?? null,
    surel: prodi?.surel ?? null,
    situs: prodi?.situs ?? null,
    logoInstitusi: institusi ? logoKop("/api/institusi/logo", institusi) : null,
    logoProdi: prodi ? logoKop(`/api/prodi/${prodi.id}/logo`, prodi) : null,
  };
}

/**
 * Kop untuk DILIHAT — pratinjau naskah, kepala halaman. Tanpa bita: gambarnya
 * diambil peramban lewat rutenya sendiri.
 */
export async function muatKopTampil(
  prodiId: string,
  bahasa: Bahasa = "id",
): Promise<KopLembaga> {
  const [institusi, prodi] = await Promise.all([
    prisma.institusi.findFirst({ select: PILIH_INSTITUSI }),
    prisma.prodi.findUnique({ where: { id: prodiId }, select: PILIH }),
  ]);
  return rakit(institusi, prodi, bahasa);
}

/**
 * Kop untuk DICETAK — membawa bita kedua lambang, karena `docx` menanam
 * gambar ke dalam berkasnya.
 */
export async function muatKopCetak(
  prodiId: string,
  bahasa: Bahasa = "id",
): Promise<KopLembaga> {
  const [institusi, prodi] = await Promise.all([
    prisma.institusi.findFirst({ select: { ...PILIH_INSTITUSI, logo: true } }),
    prisma.prodi.findUnique({
      where: { id: prodiId },
      select: { ...PILIH, logo: true },
    }),
  ]);
  return rakit(institusi, prodi, bahasa);
}
