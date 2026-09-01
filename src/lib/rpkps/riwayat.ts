import "server-only";
import type { Prisma } from "@/generated/prisma";
import { type DataRiwayat } from "@/domain/rpkps/riwayat";
import { teksRiwayat } from "@/lib/bahasa/riwayat";
import { id } from "@/kamus/id";

/**
 * Medan `data` + `deskripsi` untuk satu baris `rpkps_riwayat`.
 *
 * Keduanya ditulis bersama: `data` supaya kalimatnya dapat dirakit ulang dalam
 * bahasa pembacanya, `deskripsi` sebagai cadangan bahasa Indonesia yang tetap
 * terbaca bila suatu saat sebuah kunci hilang dari kamus — dan yang ikut
 * membeku ke dalam `rpkps_snapshot` apa adanya.
 */
export function barisRiwayat(peristiwa: DataRiwayat): {
  data: Prisma.InputJsonValue;
  deskripsi: string;
} {
  // Prisma menuntut bentuk Json-nya sendiri; `DataRiwayat` adalah antarmuka
  // tanpa index signature, jadi ia tidak cocok secara struktural meskipun
  // isinya memang Json. Konversi ini satu-satunya tempat yang melakukannya.
  return {
    data: peristiwa as unknown as Prisma.InputJsonValue,
    deskripsi: teksRiwayat(peristiwa, "", id),
  };
}
