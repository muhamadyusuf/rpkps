import { z } from "zod";

/**
 * Skema keluaran tugas BUKU_DIAGRAM — docs/17 §4.1.
 *
 * Murni: hanya zod. Dipisah dari `buku-ajar.ts` yang `server-only` supaya
 * dapat diuji, sama seperti `skema-buku.ts`.
 *
 * Tanpa `.nullable()`, dengan alasan yang sama seperti skema lain: tiap
 * percabangan memperbesar grammar structured output. Isian yang tidak berlaku
 * diisi string kosong, dan `rapikanDiagram` di domain menerjemahkannya.
 *
 * Yang sengaja TIDAK ada di sini: medan untuk gambar raster. Diagram ditulis
 * sebagai KODE (docs/17 I1); model tidak pernah diminta mengembalikan piksel,
 * dan tidak ada tempat baginya melakukan itu.
 */
export const SkemaDiagram = z.object({
  gambar: z.array(
    z.object({
      /** Keterangan gambar; tercetak di bawahnya dan masuk Daftar Gambar. */
      judul: z.string(),
      /** Untuk pembaca layar: apa yang digambarkan, dalam satu kalimat. */
      alt: z.string(),
      /** Judul subbab tempat gambar ini berada, disalin persis. */
      letak: z.string(),
      bentuk: z.enum(["MERMAID", "SVG"]),
      kode: z.string(),
    }),
  ),
});

export type KeluaranDiagram = z.infer<typeof SkemaDiagram>;
