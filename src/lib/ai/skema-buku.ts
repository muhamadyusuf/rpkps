import { z } from "zod";
import { LEVEL_BLOOM } from "@/domain/kurikulum/bloom";

/**
 * Skema keluaran terstruktur tugas BUKU_* — docs/16 §3.
 *
 * Dipisah dari `buku-ajar.ts` karena modul itu `server-only` sehingga tidak
 * dapat diimpor uji. Modul ini murni: hanya zod dan konstanta domain.
 *
 * # Tidak ada satu pun `.nullable()`
 *
 * Alasannya sama persis dengan `skema-draf.ts`: structured output mengekang
 * keluaran model lewat grammar hasil kompilasi skema, dan yang mahal bagi
 * grammar adalah PERCABANGAN — tiap `.nullable()` menjadi `anyOf: [T, null]`.
 * Isian yang tidak berlaku diisi string KOSONG, dan `rapikanIsiBab()` di
 * domain yang menerjemahkannya kembali menjadi `null`.
 *
 * # Yang sengaja TIDAK ada di skema mana pun di berkas ini
 *
 * `isbn`, `penerbit`, `tahun_terbit`, `edisi`, dan `hak_cipta`. Bukan karena
 * lupa: metadata terbitan diisi manusia (docs/16 P5). Melarangnya lewat
 * panduan saja tidak cukup — panduan dapat dilanggar, sedangkan medan yang
 * tidak ada pada skema tidak dapat diisi model dengan cara apa pun. Uji
 * `skema-buku.test.ts` menjaga larangan ini.
 */

const KODE_BLOOM = LEVEL_BLOOM.map((l) => l.level) as [string, ...string[]];

/** Tahap 1 — kerangka buku: judul dan peta bab. Belum ada isi. */
export const SkemaKerangkaBuku = z.object({
  judul_buku: z.string(),
  subjudul: z.string(),
  bab: z.array(
    z.object({
      nomor: z.number(),
      judul: z.string(),
      /** Satu kalimat: apa yang dikerjakan bab ini dalam alur buku. */
      alur: z.string(),
    }),
  ),
});

/** Tahap 2 — isi SATU bab. Satu panggilan per bab (docs/16 §3.1). */
export const SkemaBab = z.object({
  uraian: z.string(),
  studi_kasus: z.string(),
  ringkasan: z.string(),
  latihan: z.array(
    z.object({
      soal: z.string(),
      kunci: z.string(),
      bloom: z.enum(KODE_BLOOM),
    }),
  ),
  /**
   * Nomor pustaka RPKPS yang dirujuk bab ini. Nomor, bukan judul: judul yang
   * ditulis ulang model adalah pintu masuk pustaka karangan (docs/16 P6).
   */
  sitiran: z.array(z.number()),
});

/** Tahap 3 — slide satu bab. */
export const SkemaSlideBab = z.object({
  slide: z.array(
    z.object({
      judul: z.string(),
      butir: z.array(z.string()),
      /** Menjadi speaker notes; tidak pernah tercetak di badan slide. */
      catatan: z.string(),
    }),
  ),
});

/** Tahap 4 — kelengkapan buku, disusun setelah seluruh bab ada. */
export const SkemaKelengkapan = z.object({
  prakata: z.string(),
  pendahuluan: z.string(),
  glosarium: z.array(z.object({ istilah: z.string(), arti: z.string() })),
  biografi: z.string(),
});

export type KeluaranKerangkaBuku = z.infer<typeof SkemaKerangkaBuku>;
export type KeluaranBab = z.infer<typeof SkemaBab>;
export type KeluaranSlideBab = z.infer<typeof SkemaSlideBab>;
export type KeluaranKelengkapan = z.infer<typeof SkemaKelengkapan>;
