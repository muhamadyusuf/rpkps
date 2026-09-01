/**
 * Perakit kalimat temuan.
 *
 * Validator hidup di `src/domain` dan harus tetap murni: tanpa Prisma, tanpa
 * React, dan — sejak L3 — tanpa kalimat. Yang dihasilkannya adalah `kode` dan
 * `params`; kalimatnya dirakit di sini, dalam bahasa pembacanya.
 *
 * Alasannya bukan sekadar kerapian. Satu temuan yang sama dibaca di layar
 * dosen, di panel Kaprodi, dan di ekspor DOCX — tiga pembaca yang boleh
 * berbeda bahasa. Kalimat yang sudah jadi sejak di domain memaksa ketiganya
 * memakai bahasa yang kebetulan dipilih penulis validator.
 */

import type { Kamus } from "@/kamus";
import { id } from "@/kamus/id";
import { isi } from "./teks";
import { durasi } from "./format";
import type { ParamTemuan } from "@/domain/rpkps/tipe";

/** Bentuk minimal sebuah temuan — ketiga tipe temuan domain memenuhinya. */
export interface TemuanBerkode {
  kode: string;
  params?: Record<string, ParamTemuan>;
}

export interface TeksTemuan {
  pesan: string;
  saran?: string;
}

/**
 * Kalimat sebuah temuan.
 *
 * Kode yang belum ada di kamus mengembalikan kodenya sendiri, bukan string
 * kosong: "B7-ENTAH-APA" di layar segera dilaporkan seseorang, sedangkan baris
 * kosong tampak seperti temuan tanpa penjelasan dan bertahan berbulan-bulan.
 * Penjaganya `temuan.test.ts`, yang menuntut setiap kode domain ada di kedua
 * kamus — jadi jalur ini semestinya tidak pernah terpakai.
 */
export function teksTemuan(temuan: TemuanBerkode, kam: Kamus): TeksTemuan {
  const entri = kam.temuan[temuan.kode as keyof Kamus["temuan"]];
  if (!entri) return { pesan: temuan.kode };

  const params = ratakan(temuan.params ?? {}, kam);
  return {
    pesan: isi(entri.pesan, params),
    saran: "saran" in entri && entri.saran ? isi(entri.saran, params) : undefined,
  };
}

/** Durasi bertanda menjadi kata; sisanya apa adanya. */
function ratakan(
  params: Record<string, ParamTemuan>,
  kam: Kamus,
): Record<string, string | number> {
  const keluar: Record<string, string | number> = {};
  for (const [nama, nilai] of Object.entries(params)) {
    keluar[nama] =
      typeof nilai === "object" && nilai !== null && "menit" in nilai
        ? durasi(nilai.menit, kam)
        : nilai;
  }
  return keluar;
}

/**
 * Kalimat Indonesia sebuah temuan, tanpa perlu memuat kamus lebih dulu.
 *
 * Dua pemakai, dan keduanya memang selalu Indonesia: prompt perbaikan AI —
 * bahasa buku kurikulum yang sedang diperbaikinya — dan uji domain, yang
 * menegaskan bahwa `params` sebuah aturan benar-benar mengisi penanda pada
 * kalimatnya. Penanda yang salah nama akan lolos `tsc` tetapi tertinggal utuh
 * sebagai "{daftar}" di hasil render, dan di situlah uji menangkapnya.
 */
export function pesanTemuanId(temuan: TemuanBerkode): string {
  return teksTemuan(temuan, id).pesan;
}
