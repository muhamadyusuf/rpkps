import { z } from "zod";
import { GalatAi } from "../galat";
import type { JawabanPenyedia, PermintaanPenyedia, Penyedia } from "./tipe";

/**
 * Adapter Mistral, lewat REST langsung.
 *
 * Tidak memakai SDK: bentuk permintaannya diambil dari OpenAPI resmi Mistral
 * (POST /v1/chat/completions, response_format.json_schema) dan cukup kecil
 * untuk ditulis apa adanya — satu dependensi lagi tidak sepadan.
 *
 * Perbedaan yang perlu diketahui dibanding adapter Anthropic:
 * - Tidak ada prompt caching. Blok panduan dibayar penuh setiap panggilan.
 * - Kepatuhan skema lebih longgar meski `strict: true`, jadi keluaran tetap
 *   diparse ulang dengan Zod di sini dan gagalnya dilaporkan sebagai
 *   SKEMA_GAGAL, bukan dilempar sebagai galat.
 */

const URL_API = "https://api.mistral.ai/v1/chat/completions";
const BATAS_WAKTU_MS = 120_000;

/** Bentuk respons yang benar-benar dipakai. Field lain sengaja diabaikan. */
const SkemaRespons = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullish() }).nullish(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
    })
    .nullish(),
});

export function penyediaMistral(apiKey: string): Penyedia {
  return {
    kode: "mistral",
    modelBawaan: "mistral-large-latest",

    async chat<T>(p: PermintaanPenyedia<T>): Promise<JawabanPenyedia<T>> {
      const badan = {
        model: p.model,
        max_tokens: p.maxTokens,
        messages: [
          { role: "system", content: p.panduan },
          { role: "user", content: p.permintaan },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "usulan_perbaikan",
            schema: skemaJson(p.skema),
            strict: true,
          },
        },
      };

      const respons = await kirim(apiKey, badan);
      const terurai = SkemaRespons.safeParse(respons);
      if (!terurai.success) {
        console.error("[ai:mistral] bentuk respons tak dikenal:", respons);
        throw new GalatAi("Respons Mistral tidak dapat dibaca. Periksa log server.");
      }

      const pilihan = terurai.data.choices[0];
      const pemakaian = {
        tokenMasuk: terurai.data.usage?.prompt_tokens ?? null,
        tokenKeluar: terurai.data.usage?.completion_tokens ?? null,
        // Mistral tidak melaporkan cache pada endpoint ini.
        tokenCacheBaca: null,
        tokenCacheTulis: null,
      };

      // "length" dan "model_length" sama-sama berarti jawaban terpotong.
      if (pilihan.finish_reason === "length" || pilihan.finish_reason === "model_length") {
        return { data: null, alasan: "TERPOTONG", pemakaian };
      }

      const isi = pilihan.message?.content;
      if (!isi) return { data: null, alasan: "SKEMA_GAGAL", pemakaian };

      let json: unknown;
      try {
        json = JSON.parse(isi);
      } catch {
        return { data: null, alasan: "SKEMA_GAGAL", pemakaian };
      }

      const hasil = p.skema.safeParse(json);
      return hasil.success
        ? { data: hasil.data, alasan: "SELESAI", pemakaian }
        : { data: null, alasan: "SKEMA_GAGAL", pemakaian };
    },
  };
}

/**
 * Zod → JSON Schema. `$schema` dibuang karena Mistral hanya mengharapkan
 * badan skemanya. Objek Zod menghasilkan `additionalProperties: false` dan
 * daftar `required` yang lengkap, yang memang dituntut mode strict.
 */
function skemaJson(skema: z.ZodType<unknown>): Record<string, unknown> {
  const json = z.toJSONSchema(skema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

async function kirim(apiKey: string, badan: unknown): Promise<unknown> {
  let respons: Response;
  try {
    respons = await fetch(URL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(badan),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
  } catch (galat) {
    if (galat instanceof Error && galat.name === "TimeoutError") {
      throw new GalatAi("Mistral tidak menjawab dalam batas waktu.");
    }
    throw new GalatAi("Server tidak dapat menghubungi Mistral.");
  }

  if (!respons.ok) throw new GalatAi(pesanGalat(respons.status));
  try {
    return await respons.json();
  } catch {
    throw new GalatAi("Respons Mistral bukan JSON yang sah.");
  }
}

function pesanGalat(status: number): string {
  switch (status) {
    case 401:
      return `Mistral menolak kunci API Anda (401). Perbarui di Pengaturan → Kunci AI.`;
    case 403:
      return `Kunci Mistral Anda tidak berwenang memakai model ini (403). Pilih model lain, atau periksa langganan akun Mistral Anda. Perbarui di Pengaturan → Kunci AI.`;
    case 404:
      return `Model Mistral yang diminta tidak ditemukan (404). Periksa isian Model pada kunci ini. Perbarui di Pengaturan → Kunci AI.`;
    case 422:
      return "Mistral menolak bentuk permintaan. Periksa log server.";
    case 429:
      return "Batas pemakaian Mistral tercapai. Coba lagi beberapa saat lagi.";
    default:
      return status >= 500
        ? "Mistral sedang bermasalah. Coba lagi beberapa saat lagi."
        : `Mistral mengembalikan galat ${status}.`;
  }
}
