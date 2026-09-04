import { z } from "zod";

/**
 * Skema keluaran tugas penyuntingan naskah — docs/19.
 *
 * Murni: hanya zod. Tanpa `.nullable()`, dengan alasan yang sama seperti
 * skema lain di folder ini.
 *
 * # Bentuknya memaksa model menjadi editor, bukan penulis kedua
 *
 * Perhatikan `kutipan`: model WAJIB menyalin potongan yang hendak diubahnya.
 * Ia tidak dapat mengembalikan "bab yang sudah diperbaiki" karena tidak ada
 * medan untuk itu — yang ada hanyalah pasangan kutipan, penggantinya, dan
 * alasannya. Larangan docs/19 E1 dengan demikian ditegakkan bentuk skema,
 * bukan oleh kepatuhan model terhadap panduan.
 */

const JENIS = ["BAHASA", "ISTILAH", "PENGULANGAN", "TUJUAN", "STRUKTUR"] as const;

/** Tahap penyuntingan satu bab: usulan pada tingkat kalimat. */
export const SkemaSuntingBab = z.object({
  usulan: z.array(
    z.object({
      /** Potongan PERSIS dari uraian bab. Tanpa ini tidak ada yang dapat diganti. */
      kutipan: z.string(),
      /** Penggantinya. Kosong berarti potongan itu sebaiknya dihapus. */
      usul: z.string(),
      /** Mengapa. Inilah yang dibaca dosen sebelum memutuskan. */
      alasan: z.string(),
      jenis: z.enum(JENIS),
    }),
  ),
});

/** Tinjauan seluruh naskah: temuan lintas bab, tanpa kutipan. */
export const SkemaTinjauNaskah = z.object({
  temuan: z.array(
    z.object({
      /** Nomor bab yang paling bersangkutan; 0 bila menyangkut seluruh buku. */
      bab: z.number(),
      usul: z.string(),
      alasan: z.string(),
      jenis: z.enum(JENIS),
    }),
  ),
});

/**
 * Sinopsis sampul belakang dan kata kuncinya.
 *
 * Keduanya TULISAN, bukan metadata terbitan — jadi larangan docs/16 P5 (ISBN,
 * penerbit, tahun tidak pernah dari model) tidak berlaku di sini, dan memang
 * tidak ada satu pun medan semacam itu pada skema ini.
 */
export const SkemaSinopsis = z.object({
  sinopsis: z.string(),
  kata_kunci: z.array(z.string()),
});

export type KeluaranSuntingBab = z.infer<typeof SkemaSuntingBab>;
export type KeluaranTinjauNaskah = z.infer<typeof SkemaTinjauNaskah>;
export type KeluaranSinopsis = z.infer<typeof SkemaSinopsis>;
