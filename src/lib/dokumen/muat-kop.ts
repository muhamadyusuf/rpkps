import "server-only";
import { prisma } from "@/lib/prisma";
import { pilihTeks } from "@/lib/bahasa/teks";
import { labelDokumen } from "@/lib/dokumen/label";
import { type KopLembaga, type LogoKop } from "./kop";
import type { Bahasa } from "@/kamus";

/**
 * Pembacaan kop lembaga dari basis data. Bentuk dan aturannya ada di
 * `kop.ts`, yang sengaja murni supaya pencetak dapat diuji di luar Next.
 *
 * Dua pemuat, bukan satu berbendera: yang untuk DILIHAT tidak menarik bita
 * gambar sama sekali, karena halaman merendernya lewat `<img>` ke rute
 * lambang. Satu pemuat berbendera `cetak: boolean` terlihat lebih rapi dan
 * berakhir sebagai `false` yang lupa dipasang — dan biayanya setengah
 * megabita pada tiap render panel pratinjau (docs/21 §2.2).
 */

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
