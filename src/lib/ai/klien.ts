import "server-only";
import { GalatAi } from "./galat";
import { penyediaAnthropic } from "./penyedia/anthropic";
import { penyediaMistral } from "./penyedia/mistral";
import type { Penyedia } from "./penyedia/tipe";

/**
 * Resolusi penyedia dan kredensial AI.
 *
 * Tahap ini memakai SATU kunci institusi per penyedia, dari variabel
 * lingkungan — bukan kunci per dosen. docs/01 §2.1 merancang `scope`
 * ('user' | 'prodi' | 'institusi'); bila kelak BYOK per dosen dibangun,
 * lapisannya masuk di fungsi ini saja dan tanda tangan pemanggil tidak
 * berubah, karena pemanggil sudah menyerahkan penggunaId ke gerbang.
 */

export { GalatAi };

const PENYEDIA = {
  anthropic: { env: "ANTHROPIC_API_KEY", buat: penyediaAnthropic },
  mistral: { env: "MISTRAL_API_KEY", buat: penyediaMistral },
} as const;

export type KodePenyedia = keyof typeof PENYEDIA;

const BAWAAN: KodePenyedia = "anthropic";

function kodePenyedia(): KodePenyedia {
  const nilai = process.env.AI_PENYEDIA?.trim().toLowerCase();
  if (!nilai) return BAWAAN;
  if (nilai in PENYEDIA) return nilai as KodePenyedia;
  // Salah ketik tidak boleh diam-diam jatuh ke penyedia lain: dosen bisa
  // mengira sedang memakai Mistral padahal tagihannya jalan di Anthropic.
  console.error(`[ai] AI_PENYEDIA="${nilai}" tidak dikenal; fitur AI dimatikan.`);
  return BAWAAN;
}

function penyediaSah(): boolean {
  const nilai = process.env.AI_PENYEDIA?.trim().toLowerCase();
  return !nilai || nilai in PENYEDIA;
}

function kunci(kode: KodePenyedia): string | null {
  const nilai = process.env[PENYEDIA[kode].env]?.trim();
  return nilai ? nilai : null;
}

/** Dipakai halaman untuk menyembunyikan tombol AI bila kunci belum dipasang. */
export function aiTersedia(): boolean {
  return penyediaSah() && kunci(kodePenyedia()) !== null;
}

export interface PenyediaTerpilih {
  penyedia: Penyedia;
  model: string;
}

export function pilihPenyedia(): PenyediaTerpilih {
  if (!penyediaSah()) {
    throw new GalatAi(
      `AI_PENYEDIA tidak dikenal. Pilihannya: ${Object.keys(PENYEDIA).join(", ")}.`,
    );
  }

  const kode = kodePenyedia();
  const apiKey = kunci(kode);
  if (!apiKey) {
    throw new GalatAi(
      `Fitur AI belum aktif. Admin perlu mengisi ${PENYEDIA[kode].env} di server.`,
    );
  }

  const penyedia = PENYEDIA[kode].buat(apiKey);
  // AI_MODEL berlaku lintas penyedia; kosongkan agar tiap penyedia memakai
  // model bawaannya sendiri, karena nama modelnya jelas tidak saling cocok.
  return { penyedia, model: process.env.AI_MODEL?.trim() || penyedia.modelBawaan };
}
