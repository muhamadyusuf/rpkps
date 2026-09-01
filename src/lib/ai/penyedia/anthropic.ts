import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GalatAi } from "../galat";
import { bersihkanPesan, kalimatDaftarModel, type HasilModel } from "./galat-http";
import type { JawabanPenyedia, PermintaanPenyedia, Penyedia } from "./tipe";

/**
 * Adapter Anthropic (Claude). Penyedia utama menurut docs/01 §2.4.
 *
 * Satu-satunya adapter dengan prompt caching EKSPLISIT: blok panduan dikirim
 * dengan cache_control sehingga panggilan kedua dan seterusnya hanya membayar
 * sebagian kecil untuknya. Gemini melakukannya sendiri tanpa dapat diatur;
 * Mistral tidak sama sekali.
 *
 * SELALU memakai streaming, meski hasilnya baru dipakai setelah lengkap. SDK
 * menolak permintaan NON-streaming yang diperkirakan berjalan lebih dari 10
 * menit, dan perkiraannya semata-mata dari max_tokens:
 * (60 menit x max_tokens) / 128000. Ambangnya jatuh di max_tokens 21.333 —
 * di atas itu SDK melempar AnthropicError sebelum permintaan terkirim.
 * Menyusun draf RPKPS utuh butuh jauh lebih banyak dari itu.
 */

/**
 * Klien dibuat ULANG untuk setiap kunci — TIDAK di-cache pada variabel modul.
 *
 * Sebelumnya berkas ini menyimpan `let klien` dan memakai `klien ??= new
 * Anthropic({ apiKey })`. Selama kunci hanya satu milik institusi itu tidak
 * kelihatan. Sejak kunci melekat pada dosen (docs/08), pola itu berarti dosen
 * kedua pada proses server yang sama memanggil dengan kunci — dan TAGIHAN —
 * dosen pertama. Pembuatan klien Anthropic murah; kebocoran kredensial tidak.
 */
export function penyediaAnthropic(apiKey: string): Penyedia {
  const klien = new Anthropic({ apiKey });

  return {
    kode: "anthropic",
    modelBawaan: "claude-opus-5",

    async chat<T>(p: PermintaanPenyedia<T>): Promise<JawabanPenyedia<T>> {
      let respons;
      try {
        const aliran = klien.beta.messages.stream({
          model: p.model,
          max_tokens: p.maxTokens,
          // Penalaran akademik lintas CPL/CPMK/Sub-CPMK bukan tugas dangkal.
          thinking: { type: "adaptive" },
          // Bila model menolak, penyedia mengulang sendiri ke model cadangan
          // dalam panggilan yang sama.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [
            { type: "text", text: p.panduan, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: p.permintaan }],
          output_config: { format: zodOutputFormat(p.skema) },
        });
        respons = await aliran.finalMessage();
      } catch (galat) {
        throw new GalatAi(await pesanGalat(galat, klien, apiKey, p.model));
      }

      const pemakaian = {
        tokenMasuk: respons.usage.input_tokens,
        tokenKeluar: respons.usage.output_tokens,
        tokenCacheBaca: respons.usage.cache_read_input_tokens,
        tokenCacheTulis: respons.usage.cache_creation_input_tokens,
      };

      if (respons.stop_reason === "refusal") {
        return { data: null, alasan: "DITOLAK", pemakaian };
      }
      if (respons.stop_reason === "max_tokens") {
        return { data: null, alasan: "TERPOTONG", pemakaian };
      }
      if (!respons.parsed_output) {
        return { data: null, alasan: "SKEMA_GAGAL", pemakaian };
      }
      return { data: respons.parsed_output, alasan: "SELESAI", pemakaian };
    },
  };
}

/**
 * Katalog model milik kunci ini, dipakai saat model yang diminta ditolak.
 * Retry dimatikan dan batas waktunya pendek: ini penyelidikan tambahan di
 * jalur galat, bukan permintaan yang ditunggu pengguna.
 */
async function daftarModel(klien: Anthropic): Promise<HasilModel> {
  try {
    const halaman = await klien.models.list(
      { limit: 50 },
      { timeout: 15_000, maxRetries: 0 },
    );
    const model = halaman.data.map((m) => m.id).sort();
    return model.length > 0 ? { jenis: "daftar", model } : { jenis: "tertutup" };
  } catch (galat) {
    return galat instanceof Anthropic.AuthenticationError ||
      galat instanceof Anthropic.PermissionDeniedError
      ? { jenis: "tertutup" }
      : { jenis: "gagal" };
  }
}

/** Memetakan galat SDK jadi pesan Indonesia tanpa membocorkan kunci. */
async function pesanGalat(
  galat: unknown,
  klien: Anthropic,
  apiKey: string,
  model: string,
): Promise<string> {
  // Kalimat SDK ikut dikutip: tanpanya "tidak berwenang" tidak pernah
  // menerangkan APA yang tidak berwenang, dan dosen hanya bisa menebak.
  const alasan =
    galat instanceof Anthropic.APIError && galat.message
      ? ` Anthropic menjawab: "${bersihkanPesan(galat.message, apiKey)}".`
      : "";

  if (galat instanceof Anthropic.AuthenticationError) {
    return `Anthropic menolak kunci API Anda.${alasan} Perbarui di Pengaturan → Kunci AI.`;
  }
  if (galat instanceof Anthropic.PermissionDeniedError) {
    return (
      `Kunci Anthropic Anda sah, tetapi tidak berwenang memakai model "${model}".` +
      `${alasan} ${kalimatDaftarModel(await daftarModel(klien), "Anthropic")}`
    );
  }
  if (galat instanceof Anthropic.NotFoundError) {
    return (
      `Model Anthropic "${model}" tidak ditemukan.${alasan} ` +
      kalimatDaftarModel(await daftarModel(klien), "Anthropic")
    );
  }
  if (galat instanceof Anthropic.RateLimitError) {
    return "Batas pemakaian Anthropic tercapai. Coba lagi beberapa saat lagi.";
  }
  if (galat instanceof Anthropic.BadRequestError) {
    console.error("[ai:anthropic] permintaan ditolak:", galat.message);
    // Ditolak SEBELUM model berjalan, karena skema keluaran terlalu rumit
    // untuk dikompilasi menjadi grammar. Pesan aslinya berbahasa Inggris dan
    // menyebut "tool schemas" — padahal yang perlu disederhanakan di sini
    // adalah skema keluaran. Lihat src/lib/ai/skema-draf.ts.
    if (galat.message.includes("compiled grammar is too large")) {
      return (
        "Skema keluaran terlalu rumit untuk structured output Anthropic. " +
        "Sederhanakan skemanya — kurangi percabangan (nullable/union) — atau " +
        "pecah tugasnya menjadi beberapa panggilan."
      );
    }
    return "Permintaan ke Anthropic ditolak. Periksa log server.";
  }
  if (galat instanceof Anthropic.APIConnectionError) {
    return "Server tidak dapat menghubungi Anthropic.";
  }
  if (galat instanceof Anthropic.APIError) {
    return `Anthropic mengembalikan galat ${galat.status ?? ""}.`.trim();
  }
  // AnthropicError adalah induk semua galat SDK, termasuk yang dilempar
  // SEBELUM permintaan terkirim. Tanpa cabang ini pesannya jatuh ke
  // "galat tak terduga" dan penyebabnya hanya terlihat di log server.
  if (galat instanceof Anthropic.AnthropicError) {
    console.error("[ai:anthropic] permintaan ditolak SDK:", galat.message);
    return `Permintaan ditolak SDK Anthropic: ${galat.message}`;
  }
  console.error("[ai:anthropic] galat tak terduga:", galat);
  return "Terjadi galat saat memanggil Anthropic. Periksa log server.";
}
