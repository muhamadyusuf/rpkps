import "server-only";
import { GalatAi } from "./galat";
import { penyediaAnthropic } from "./penyedia/anthropic";
import { penyediaGemini } from "./penyedia/gemini";
import { penyediaMistral } from "./penyedia/mistral";
import type { Penyedia } from "./penyedia/tipe";
import type { PenyediaAi } from "@/generated/prisma";

/**
 * Pemetaan penyedia → adapter.
 *
 * Sejak docs/08 (Mode A), berkas ini TIDAK LAGI membaca variabel lingkungan.
 * `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `GEMINI_API_KEY`, `AI_PENYEDIA`, dan
 * `AI_MODEL` sudah pensiun: kunci dan model melekat pada kredensial milik
 * dosen, dan resolusinya ada di `kredensial.ts`. Yang tersisa di sini semata
 * pembuatan adapter dari kunci yang sudah dibuka.
 */

export { GalatAi };

const ADAPTER: Record<PenyediaAi, (apiKey: string) => Penyedia> = {
  ANTHROPIC: penyediaAnthropic,
  MISTRAL: penyediaMistral,
  GEMINI: penyediaGemini,
};

export const LABEL_PENYEDIA: Record<PenyediaAi, string> = {
  ANTHROPIC: "Anthropic (Claude)",
  MISTRAL: "Mistral",
  GEMINI: "Google Gemini",
};

/** Petunjuk tempat membuat kunci, ditampilkan di halaman pengaturan. */
export const ASAL_KUNCI: Record<PenyediaAi, string> = {
  ANTHROPIC: "console.anthropic.com → API Keys",
  MISTRAL: "console.mistral.ai → API Keys",
  GEMINI: "aistudio.google.com → Get API key",
};

export const DAFTAR_PENYEDIA = Object.keys(ADAPTER) as PenyediaAi[];

export function buatPenyedia(kode: PenyediaAi, apiKey: string): Penyedia {
  const buat = ADAPTER[kode];
  if (!buat) throw new GalatAi(`Penyedia ${kode} tidak dikenal.`);
  return buat(apiKey);
}

/** Model bawaan adapter, dipakai bila dosen tidak menyebut model sendiri. */
export function modelBawaan(kode: PenyediaAi): string {
  return buatPenyedia(kode, "tanpa-kunci").modelBawaan;
}

export interface PenyediaTerpilih {
  penyedia: Penyedia;
  model: string;
  /** Kredensial milik dosen yang menanggung panggilan ini. */
  kredensialId: string;
}
