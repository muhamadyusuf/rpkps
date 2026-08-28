import type { z } from "zod";

/**
 * Adapter di folder ini sengaja TIDAK ditandai `server-only`: semuanya
 * menerima apiKey sebagai argumen dan tidak pernah membaca process.env, jadi
 * batas rahasianya ada di klien.ts — yang server-only. Konsekuensinya adapter
 * dapat diuji langsung tanpa menjalankan Next.
 *
 * Antarmuka penyedia LLM. Aplikasi berbicara dalam istilah ini, bukan dalam
 * istilah SDK penyedia mana pun — docs/01 §2.4.
 *
 * Kontraknya sengaja sempit: satu blok panduan yang stabil, satu blok
 * permintaan yang berubah, dan satu skema keluaran. Fitur khas satu penyedia
 * (prompt caching Anthropic, reasoning_effort Mistral, responseSchema Gemini
 * yang hanya menerima sebagian JSON Schema) diurus di dalam adapternya, tidak
 * bocor ke pemanggil.
 */

export interface PermintaanPenyedia<T> {
  model: string;
  /** Blok stabil: panduan dan kamus. Adapter boleh meng-cache-nya. */
  panduan: string;
  /** Blok berubah: konteks permintaan ini. */
  permintaan: string;
  skema: z.ZodType<T>;
  maxTokens: number;
}

export type AlasanBerhenti =
  | "SELESAI"
  /** Jawaban terpotong karena batas token. */
  | "TERPOTONG"
  /** Model menolak memproses permintaan. */
  | "DITOLAK"
  /** Jawaban tidak sesuai skema yang diminta. */
  | "SKEMA_GAGAL";

export interface PemakaianToken {
  tokenMasuk: number | null;
  tokenKeluar: number | null;
  /** Hanya terisi pada penyedia yang mendukung prompt caching. */
  tokenCacheBaca: number | null;
  tokenCacheTulis: number | null;
}

export interface JawabanPenyedia<T> {
  data: T | null;
  alasan: AlasanBerhenti;
  pemakaian: PemakaianToken | null;
}

export interface Penyedia {
  readonly kode: string;
  readonly modelBawaan: string;
  /** Melempar GalatAi bila panggilan gagal; kegagalan skema dikembalikan sebagai jawaban. */
  chat<T>(permintaan: PermintaanPenyedia<T>): Promise<JawabanPenyedia<T>>;
}
