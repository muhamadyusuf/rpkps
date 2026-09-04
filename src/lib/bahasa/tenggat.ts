import { jamak } from "./teks";
import { id } from "@/kamus/id";
import type { Bahasa, Kamus } from "@/kamus";
import type { NilaiTenggat, TahapTenggat } from "@/domain/rpkps/tenggat";

/**
 * Kalimat sebuah penilaian tenggat, dirakit saat DIBACA.
 *
 * Domain mengembalikan tahap, tingkat, dan sisa hari — tidak pernah kalimat
 * (docs/11 §4.1). Perakitannya di sini karena hanya di sini ada kamus, dan
 * karena bentuk jamaknya berbeda antar bahasa: bahasa Indonesia menulis "3
 * hari" untuk berapa pun, bahasa Inggris membedakan "1 day" dan "3 days".
 */

const KUNCI = {
  PENYUSUNAN: "penyusunan",
  REVIEW: "review",
  PENGESAHAN: "pengesahan",
} as const satisfies Record<Exclude<TahapTenggat, "SELESAI">, keyof Kamus["tenggat"]>;

export function teksTenggat(nilai: NilaiTenggat, kam: Kamus, bahasa: Bahasa): string {
  if (nilai.tingkat === "SELESAI") return kam.tenggat.selesai;
  if (nilai.tingkat === "TIDAK_ADA" || nilai.tahap === "SELESAI") return kam.tenggat.tanpa;

  const pola = kam.tenggat[KUNCI[nilai.tahap]];
  const hari = nilai.hari ?? 0;

  if (nilai.tingkat === "LEWAT") {
    // `hari` negatif saat lewat; nol berarti terlambat beberapa jam saja.
    return hari === 0 ? pola.lewatHariIni : jamak(pola.terlambat, -hari, bahasa);
  }
  return hari === 0 ? pola.hariIni : jamak(pola.tersisa, hari, bahasa);
}

/**
 * Pintasan bahasa Indonesia, untuk uji domain yang dulu memeriksa `label`.
 * Bentuknya sengaja sama dengan `pesanTemuanId`: assertion atas susunan kata
 * tetap hidup, dan sekaligus membuktikan kamusnya benar-benar terisi.
 */
export function teksTenggatId(nilai: NilaiTenggat): string {
  return teksTenggat(nilai, id, "id");
}
