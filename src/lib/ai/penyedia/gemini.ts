import { z } from "zod";
import { GalatAi } from "../galat";
import {
  alasanPenyedia,
  ambilDaftarModel,
  kalimatDaftarModel,
  kutipAlasan,
} from "./galat-http";
import type { JawabanPenyedia, PermintaanPenyedia, Penyedia } from "./tipe";

/**
 * Adapter Google Gemini, lewat REST langsung.
 *
 * Tidak memakai SDK, dengan alasan yang sama seperti adapter Mistral: bentuk
 * permintaannya kecil dan stabil, sedangkan satu dependensi lagi harus dibayar
 * setiap kali aplikasi dibangun.
 *
 * Perbedaan yang perlu diketahui dibanding adapter lain:
 *
 * - **Skema keluaran bukan JSON Schema penuh.** `responseSchema` Gemini adalah
 *   himpunan bagian OpenAPI 3.0: tidak mengenal `$schema`, `additionalProperties`,
 *   maupun `$ref`. Keluaran `z.toJSONSchema` karena itu disaring lebih dulu di
 *   `keSkemaGemini` — mengirimkannya apa adanya menghasilkan galat 400.
 * - **Urutan properti tidak dijamin** kecuali diminta. Gemini menyediakan
 *   `propertyOrdering`, dan tanpanya keluaran bisa berpindah-pindah urutan
 *   antar panggilan. Kita mengisinya dari urutan properti skema.
 * - **Prompt caching berjalan sendiri** pada model 2.5 ke atas (implicit
 *   caching). Kita tidak mengaturnya, tetapi `cachedContentTokenCount`
 *   dilaporkan balik sehingga penghematannya tetap terlihat di log.
 * - **Token penalaran ikut terhitung** pada anggaran keluaran. Bila
 *   `maxTokens` habis dipakai berpikir, jawabannya kosong dengan
 *   finishReason MAX_TOKENS — dilaporkan sebagai TERPOTONG, sama seperti
 *   jawaban yang terpotong di tengah.
 */

const URL_DASAR = "https://generativelanguage.googleapis.com/v1beta/models";
const BATAS_WAKTU_MS = 120_000;

/** Bentuk respons yang benar-benar dipakai. Field lain sengaja diabaikan. */
const SkemaRespons = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().nullish(),
        content: z
          .object({ parts: z.array(z.object({ text: z.string().nullish() })).nullish() })
          .nullish(),
      }),
    )
    .nullish(),
  promptFeedback: z.object({ blockReason: z.string().nullish() }).nullish(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().nullish(),
      candidatesTokenCount: z.number().nullish(),
      thoughtsTokenCount: z.number().nullish(),
      cachedContentTokenCount: z.number().nullish(),
    })
    .nullish(),
});

/** Alasan berhenti yang berarti model menolak, bukan gagal teknis. */
const PENOLAKAN = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

export function penyediaGemini(apiKey: string): Penyedia {
  return {
    kode: "gemini",
    modelBawaan: "gemini-2.5-pro",

    async chat<T>(p: PermintaanPenyedia<T>): Promise<JawabanPenyedia<T>> {
      const badan = {
        systemInstruction: { parts: [{ text: p.panduan }] },
        contents: [{ role: "user", parts: [{ text: p.permintaan }] }],
        generationConfig: {
          maxOutputTokens: p.maxTokens,
          responseMimeType: "application/json",
          responseSchema: keSkemaGemini(z.toJSONSchema(p.skema) as Record<string, unknown>),
        },
      };

      const respons = await kirim(apiKey, p.model, badan);
      const terurai = SkemaRespons.safeParse(respons);
      if (!terurai.success) {
        console.error("[ai:gemini] bentuk respons tak dikenal:", respons);
        throw new GalatAi("Respons Gemini tidak dapat dibaca. Periksa log server.");
      }

      const keluaran = terurai.data.usageMetadata?.candidatesTokenCount ?? null;
      const berpikir = terurai.data.usageMetadata?.thoughtsTokenCount ?? null;
      const pemakaian = {
        tokenMasuk: terurai.data.usageMetadata?.promptTokenCount ?? null,
        // Token penalaran ditagih sebagai keluaran, jadi dijumlahkan agar
        // angka di log sebanding dengan penyedia lain.
        tokenKeluar: keluaran === null && berpikir === null ? null : (keluaran ?? 0) + (berpikir ?? 0),
        tokenCacheBaca: terurai.data.usageMetadata?.cachedContentTokenCount ?? null,
        // Gemini tidak menagih penulisan cache pada caching implisit.
        tokenCacheTulis: null,
      };

      // Blokir di tingkat prompt: tidak ada kandidat sama sekali.
      if (terurai.data.promptFeedback?.blockReason) {
        return { data: null, alasan: "DITOLAK", pemakaian };
      }

      const kandidat = terurai.data.candidates?.[0];
      if (!kandidat) return { data: null, alasan: "DITOLAK", pemakaian };

      const alasan = kandidat.finishReason ?? "";
      if (alasan === "MAX_TOKENS") return { data: null, alasan: "TERPOTONG", pemakaian };
      if (PENOLAKAN.has(alasan)) return { data: null, alasan: "DITOLAK", pemakaian };

      const isi = (kandidat.content?.parts ?? [])
        .map((bagian) => bagian.text ?? "")
        .join("")
        .trim();
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

/** Kata kunci JSON Schema yang dikenal `responseSchema`. Sisanya dibuang. */
const DIKENAL = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
]);

/**
 * JSON Schema (keluaran Zod) → Schema Gemini.
 *
 * Dua hal yang dikerjakan: membuang kata kunci yang tidak dikenal — terutama
 * `$schema` dan `additionalProperties`, yang ditolak Gemini dengan 400 — dan
 * menambahkan `propertyOrdering` supaya urutan properti pada jawaban tidak
 * berpindah-pindah antar panggilan.
 *
 * Tipe ditulis huruf besar mengikuti enum resminya. `type` berbentuk larik
 * (mis. `["string","null"]`, yang dihasilkan Zod untuk field nullable)
 * diterjemahkan menjadi `nullable: true`, karena Gemini tidak menerima larik.
 */
export function keSkemaGemini(skema: Record<string, unknown>): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};

  for (const [kunci, nilai] of Object.entries(skema)) {
    if (!DIKENAL.has(kunci)) continue;

    if (kunci === "type") {
      const daftar = Array.isArray(nilai) ? nilai : [nilai];
      const nyata = daftar.filter((t) => t !== "null");
      if (daftar.length !== nyata.length) hasil.nullable = true;
      hasil.type = String(nyata[0] ?? "string").toUpperCase();
      continue;
    }

    if (kunci === "properties" && nilai && typeof nilai === "object") {
      const isi: Record<string, unknown> = {};
      for (const [nama, anak] of Object.entries(nilai as Record<string, unknown>)) {
        isi[nama] = keSkemaGemini(anak as Record<string, unknown>);
      }
      hasil.properties = isi;
      hasil.propertyOrdering = Object.keys(isi);
      continue;
    }

    if (kunci === "items" && nilai && typeof nilai === "object") {
      hasil.items = keSkemaGemini(nilai as Record<string, unknown>);
      continue;
    }

    hasil[kunci] = nilai;
  }

  return hasil;
}

async function kirim(apiKey: string, model: string, badan: unknown): Promise<unknown> {
  let respons: Response;
  try {
    respons = await fetch(`${URL_DASAR}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Kunci lewat header, bukan query string: URL ikut tercatat di log
        // proxy dan riwayat peramban, header tidak.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(badan),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
  } catch (galat) {
    if (galat instanceof Error && galat.name === "TimeoutError") {
      throw new GalatAi("Gemini tidak menjawab dalam batas waktu.");
    }
    throw new GalatAi("Server tidak dapat menghubungi Gemini.");
  }

  if (!respons.ok) throw new GalatAi(await pesanGalat(respons, apiKey, model));
  try {
    return await respons.json();
  } catch {
    throw new GalatAi("Respons Gemini bukan JSON yang sah.");
  }
}

/**
 * Katalog model milik kunci ini. Nama pada respons berawalan `models/`;
 * yang diisikan dosen di kolom Model adalah bagian setelahnya.
 */
async function daftarModel(apiKey: string) {
  return ambilDaftarModel(
    URL_DASAR,
    { method: "GET", headers: { "x-goog-api-key": apiKey } },
    (badan) => {
      const terurai = z
        .object({ models: z.array(z.object({ name: z.string() })) })
        .safeParse(badan);
      return terurai.success
        ? terurai.data.models.map((m) => m.name.replace(/^models\//, "")).sort()
        : null;
    },
  );
}

/**
 * Alasan asli dari badan respons ikut dikutip. Tanpa itu 401/403 Gemini
 * bergabung menjadi satu kalimat kabur yang tidak membedakan kunci ditolak
 * dari model tidak berwenang — dua hal dengan perbaikan yang berbeda.
 */
async function pesanGalat(
  respons: Response,
  apiKey: string,
  model: string,
): Promise<string> {
  const status = respons.status;
  const alasan = kutipAlasan("Gemini", await alasanPenyedia(respons, apiKey));

  switch (status) {
    case 400:
      // Gemini memakai 400 untuk kunci tidak sah DAN untuk permintaan cacat.
      return `Gemini menolak permintaan (400) — lazimnya kunci API tidak sah.${alasan} Perbarui di Pengaturan → Kunci AI.`;
    case 401:
    case 403:
      return (
        `Gemini menolak kunci API Anda, atau kunci itu tidak berwenang memakai model "${model}" (${status}).` +
        `${alasan} ${kalimatDaftarModel(await daftarModel(apiKey), "Gemini")}`
      );
    case 404:
      // `AI_MODEL` sudah pensiun bersama kunci institusi (docs/08): model kini
      // melekat pada kredensial milik dosen, jadi ke situlah pesannya menunjuk.
      return (
        `Model Gemini "${model}" tidak ditemukan (404).${alasan} ` +
        kalimatDaftarModel(await daftarModel(apiKey), "Gemini")
      );
    case 429:
      return `Batas pemakaian Gemini tercapai.${alasan} Coba lagi beberapa saat lagi.`;
    default:
      return status >= 500
        ? "Gemini sedang bermasalah. Coba lagi beberapa saat lagi."
        : `Gemini mengembalikan galat ${status}.${alasan}`;
  }
}
