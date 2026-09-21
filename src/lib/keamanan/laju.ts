import "server-only";
import { NextResponse } from "next/server";
import { buatPembatasLaju } from "@/domain/keamanan/batas-laju";

/**
 * Instans pembatas laju aplikasi. Modul-level DISENGAJA di sini: hitungannya
 * memang harus hidup selama proses hidup. (Larangan menyimpan klien SDK pada
 * variabel modul di AGENTS.md berlaku untuk kunci AI, bukan untuk penghitung.)
 *
 * Angkanya per instans — lihat penjelasan di domain/keamanan/batas-laju.ts.
 */

/** Pertukaran token masuk: manusia tidak menekan "Masuk" sepuluh kali semenit. */
export const lajuMasuk = buatPembatasLaju({ maks: 10, jendelaMs: 60_000 });

/** Unduhan DOCX publik menyusun berkas utuh tiap kali; mahal untuk CPU. */
export const lajuUnduhPublik = buatPembatasLaju({ maks: 20, jendelaMs: 60_000 });

/**
 * Pratinjau dan penerapan impor template membuka ZIP dan mem-parse Excel di
 * proses server; per pengguna, karena yang dijaga CPU, bukan alamat (docs/23).
 */
export const lajuImporTemplat = buatPembatasLaju({ maks: 20, jendelaMs: 60_000 });

/** Penulisan temuan perangkap: pemindai dapat mengirim ribuan alamat per menit. */
export const lajuCatatPerangkap = buatPembatasLaju({ maks: 60, jendelaMs: 60_000 });

export function jawabanTerlaluBanyak(ulangDalamMs: number) {
  return NextResponse.json(
    { pesan: "Terlalu banyak permintaan. Coba lagi sebentar lagi." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(ulangDalamMs / 1000))) },
    },
  );
}
