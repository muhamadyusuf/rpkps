import type { Kamus } from "@/kamus";
import { isi as sisip } from "@/lib/bahasa/teks";
import {
  PESAN_KLIEN_BASI,
  intiPesanPrisma,
  klienBasi,
  kodePrisma,
} from "@/lib/galat-prisma";
import { GalatTulis } from "@/lib/rpkps/tulis-draf";

/**
 * Menerjemahkan galat penulisan draf menjadi kalimat yang bisa ditindaklanjuti.
 * Dipakai penerapan draf AI dan impor template: keduanya menulis lewat
 * `tulisDraf`, jadi keduanya gagal dengan cara yang sama.
 *
 * P2003 dan galat enum di sini hampir selalu berarti draf memuat nilai yang
 * tidak dikenal skema — dan itu artinya periksaDraf() kebobolan, bukan salah
 * dosen. Pesannya menyebut hal itu terang-terangan supaya cepat dilaporkan.
 */
export function pesanGagalTulis(galat: unknown, kam: Kamus): string {
  if (galat instanceof GalatTulis) {
    return sisip(kam.aksi.galatSimpan.nilaiTertaut, { daftar: galat.rincian });
  }
  if (klienBasi(galat)) return PESAN_KLIEN_BASI;
  const kode = kodePrisma(galat);

  switch (kode) {
    case "P2022":
    case "P2021":
      return kam.aksi.galatSimpan.strukturBasiSingkat;
    case "P2002":
      return kam.aksi.galatSimpan.bentrokDraf;
    case "P2003":
      return kam.aksi.galatSimpan.rujukanHilang;
    case "P2028":
      return kam.aksi.galatSimpan.transaksiDraf;
    default: {
      const nama = galat instanceof Error ? galat.constructor.name : kam.aksi.galatSimpan.galat;
      const inti = galat instanceof Error ? intiPesanPrisma(galat.message) : "";
      return `${kam.aksi.galatSimpan.gagalDraf} — ${nama}${kode ? ` (${kode})` : ""}${inti ? `: ${inti}` : "."}`;
    }
  }
}
