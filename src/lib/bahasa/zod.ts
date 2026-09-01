/**
 * Terjemahan pesan pemeriksaan Zod.
 *
 * Skema Zod adalah konstanta lingkup modul: ia disusun sekali, saat berkas
 * dimuat, jauh sebelum ada permintaan — dan karenanya jauh sebelum ada bahasa.
 * Menjadikannya pabrik `(kam) => z.object(…)` agar kamus bisa masuk akan
 * merusak `z.infer<typeof Skema>` di setiap pemanggil dan menyusun ulang
 * seluruh skema pada tiap permintaan.
 *
 * Jadi yang ditulis pada skema bukan kalimat melainkan KUNCI berawalan `@`:
 *
 *     z.string().min(2, "@aksi.periksa.namaMinimal")
 *
 * dan kalimatnya baru dirakit di sini — di tempat pesan itu benar-benar
 * dilaporkan, tempat kamus sudah tersedia. Prinsipnya sama dengan temuan
 * validator pada L3: yang disimpan adalah kode, bukan kalimat.
 *
 * Pesan tanpa `@` dilewatkan apa adanya, sehingga pesan bawaan Zod sendiri
 * ("Expected string, received number") tetap muncul utuh.
 */

import type { ZodError, ZodIssue } from "zod";
import type { Kamus } from "@/kamus";
import { isi } from "./teks";

/** Menelusuri kamus dengan jalur bertitik. Mengembalikan null bila tak ada. */
export function telusuriKamus(kam: Kamus, jalurKunci: string): string | null {
  let simpul: unknown = kam;
  for (const ruas of jalurKunci.split(".")) {
    if (typeof simpul !== "object" || simpul === null) return null;
    simpul = (simpul as Record<string, unknown>)[ruas];
  }
  return typeof simpul === "string" ? simpul : null;
}

/**
 * Pesan pertama sebuah `ZodError`, sudah berbahasa pengguna.
 *
 * Sengaja hanya yang pertama: borang di aplikasi ini pendek, dan satu kalimat
 * yang jelas lebih menolong daripada daftar yang harus dibaca seluruhnya.
 */
export function pesanZod(galat: ZodError, kam: Kamus, cadangan?: string): string {
  const masalah = galat.issues[0];
  if (!masalah) return cadangan ?? kam.aksi.umum.dataTidakValid;
  if (!masalah.message.startsWith("@")) return masalah.message;

  const pola = telusuriKamus(kam, masalah.message.slice(1));
  return pola ? isi(pola, batas(masalah)) : (cadangan ?? kam.aksi.umum.dataTidakValid);
}

/**
 * Angka `{n}` sebuah kalimat pemeriksaan diambil dari batas skemanya sendiri,
 * bukan ditulis ulang di kamus. "Minimal 20 karakter" yang dikarang di kamus
 * akan berbohong pada hari seseorang mengubah `.min(20)` menjadi `.min(30)`;
 * yang dibaca dari `issue` tidak pernah bisa.
 */
function batas(masalah: ZodIssue): Record<string, string | number> {
  if (masalah.code === "too_small") return { n: Number(masalah.minimum) };
  if (masalah.code === "too_big") return { n: Number(masalah.maximum) };
  return {};
}
