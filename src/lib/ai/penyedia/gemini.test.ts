import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";

import { keSkemaGemini, penyediaGemini } from "./gemini";
import { GalatAi } from "../galat";
import { SkemaTugasKisi } from "../skema-draf";

const Skema = z.object({ usulan: z.array(z.object({ kode: z.string() })) });

const fetchAsli = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchAsli;
});

/** Mengganti fetch dan merekam badan permintaan yang dikirim adapter. */
function stubFetch(respons: { status?: number; badan?: unknown }) {
  const terkirim: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    terkirim.push({ url, init });
    return new Response(JSON.stringify(respons.badan ?? {}), {
      status: respons.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return terkirim;
}

function permintaan() {
  return {
    model: "gemini-2.5-pro",
    panduan: "Panduan yang stabil.",
    permintaan: "Konteks kurikulum.",
    skema: Skema,
    maxTokens: 4000,
  };
}

function jawabanModel(isi: string, finishReason = "STOP") {
  return {
    candidates: [{ finishReason, content: { parts: [{ text: isi }] } }],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 },
  };
}

describe("adapter Gemini — bentuk permintaan", () => {
  it("mengirim kunci lewat header, bukan query string", async () => {
    const terkirim = stubFetch({ badan: jawabanModel('{"usulan":[]}') });

    await penyediaGemini("kunci-uji").chat(permintaan());

    assert.equal(terkirim.length, 1);
    assert.equal(
      terkirim[0].url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    );

    const header = terkirim[0].init.headers as Record<string, string>;
    assert.equal(header["x-goog-api-key"], "kunci-uji");
    // URL ikut tercatat di log proxy; kunci tidak boleh ada di sana.
    assert.ok(!terkirim[0].url.includes("kunci-uji"));
  });

  it("memisahkan panduan sebagai systemInstruction", async () => {
    const terkirim = stubFetch({ badan: jawabanModel('{"usulan":[]}') });

    await penyediaGemini("kunci-uji").chat(permintaan());

    const badan = JSON.parse(terkirim[0].init.body as string);
    assert.equal(badan.systemInstruction.parts[0].text, "Panduan yang stabil.");
    assert.equal(badan.contents[0].role, "user");
    assert.equal(badan.contents[0].parts[0].text, "Konteks kurikulum.");
    assert.equal(badan.generationConfig.maxOutputTokens, 4000);
    assert.equal(badan.generationConfig.responseMimeType, "application/json");
  });

  it("mengirim skema yang sudah disaring, tanpa kata kunci yang ditolak Gemini", async () => {
    const terkirim = stubFetch({ badan: jawabanModel('{"usulan":[]}') });

    await penyediaGemini("kunci-uji").chat(permintaan());

    const skema = JSON.parse(terkirim[0].init.body as string).generationConfig.responseSchema;
    const teks = JSON.stringify(skema);
    assert.ok(!teks.includes("$schema"));
    assert.ok(!teks.includes("additionalProperties"));
    assert.equal(skema.type, "OBJECT");
    assert.deepEqual(skema.required, ["usulan"]);
  });
});

describe("penyaring skema Gemini", () => {
  it("membuang kata kunci yang tidak dikenal dan menaikkan huruf tipe", () => {
    const hasil = keSkemaGemini({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      title: "Usulan",
      properties: { kode: { type: "string" } },
      required: ["kode"],
    });

    assert.deepEqual(hasil, {
      type: "OBJECT",
      properties: { kode: { type: "STRING" } },
      propertyOrdering: ["kode"],
      required: ["kode"],
    });
  });

  it("menyimpan propertyOrdering supaya urutan jawaban tidak berpindah-pindah", () => {
    const hasil = keSkemaGemini({
      type: "object",
      properties: { b: { type: "string" }, a: { type: "number" } },
    });
    assert.deepEqual(hasil.propertyOrdering, ["b", "a"]);
  });

  it("menerjemahkan type larik menjadi nullable", () => {
    const hasil = keSkemaGemini({ type: ["string", "null"] });
    assert.deepEqual(hasil, { nullable: true, type: "STRING" });
  });

  it("menyaring sampai ke dalam items dan properti bersarang", () => {
    const hasil = keSkemaGemini({
      type: "object",
      properties: {
        daftar: {
          type: "array",
          items: { type: "object", additionalProperties: false, properties: { n: { type: "integer" } } },
        },
      },
    }) as Record<string, Record<string, Record<string, unknown>>>;

    const items = hasil.properties.daftar.items as Record<string, unknown>;
    assert.equal(items.type, "OBJECT");
    assert.equal(items.additionalProperties, undefined);
  });

  it("mempertahankan enum dan batas angka yang memang dikenal", () => {
    const hasil = keSkemaGemini({
      type: "object",
      properties: {
        level: { type: "string", enum: ["C1", "C2"], description: "Level Bloom" },
        bobot: { type: "number", minimum: 0, maximum: 100 },
      },
    }) as Record<string, Record<string, Record<string, unknown>>>;

    assert.deepEqual(hasil.properties.level.enum, ["C1", "C2"]);
    assert.equal(hasil.properties.level.description, "Level Bloom");
    assert.equal(hasil.properties.bobot.minimum, 0);
    assert.equal(hasil.properties.bobot.maximum, 100);
  });

  it("tidak tersandung skema kosong", () => {
    assert.deepEqual(keSkemaGemini({}), {});
  });

  it("meloloskan skema draf RPKPS yang sungguhan", () => {
    // Tahap dengan sarang terdalam di aplikasi ini. Kalau penyaringnya meleset
    // di satu cabang saja, Gemini menolak dengan 400 dan penyebabnya sulit
    // dilacak dari pesan galatnya.
    const hasil = keSkemaGemini(z.toJSONSchema(SkemaTugasKisi) as Record<string, unknown>);
    const teks = JSON.stringify(hasil);

    for (const dilarang of ["$schema", "additionalProperties", "$ref", "anyOf"]) {
      assert.ok(!teks.includes(`"${dilarang}"`), `${dilarang} masih tersisa`);
    }
    // Seluruh tipe harus huruf besar; satu yang terlewat sudah cukup ditolak.
    for (const tipe of teks.match(/"type":"[^"]+"/g) ?? []) {
      assert.equal(tipe, tipe.toUpperCase().replace('"TYPE"', '"type"'));
    }
    assert.equal((hasil as { type: string }).type, "OBJECT");
    assert.ok(((hasil as { propertyOrdering: string[] }).propertyOrdering ?? []).length > 0);
  });
});

describe("adapter Gemini — jawaban", () => {
  it("mengurai jawaban yang sesuai skema", async () => {
    stubFetch({ badan: jawabanModel('{"usulan":[{"kode":"CPMK1"}]}') });

    const hasil = await penyediaGemini("k").chat(permintaan());

    assert.equal(hasil.alasan, "SELESAI");
    assert.deepEqual(hasil.data, { usulan: [{ kode: "CPMK1" }] });
    assert.equal(hasil.pemakaian?.tokenMasuk, 120);
    assert.equal(hasil.pemakaian?.tokenKeluar, 40);
  });

  it("menjumlahkan token penalaran ke token keluaran", async () => {
    stubFetch({
      badan: {
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"usulan":[]}' }] } }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 40,
          thoughtsTokenCount: 900,
          cachedContentTokenCount: 80,
        },
      },
    });

    const hasil = await penyediaGemini("k").chat(permintaan());

    // Token berpikir ikut ditagih sebagai keluaran; angka di log harus
    // sebanding dengan penyedia lain.
    assert.equal(hasil.pemakaian?.tokenKeluar, 940);
    assert.equal(hasil.pemakaian?.tokenCacheBaca, 80);
    assert.equal(hasil.pemakaian?.tokenCacheTulis, null);
  });

  it("menggabungkan jawaban yang terpecah beberapa part", async () => {
    stubFetch({
      badan: {
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: '{"usulan":' }, { text: '[{"kode":"X"}]}' }] },
          },
        ],
      },
    });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.deepEqual(hasil.data, { usulan: [{ kode: "X" }] });
  });

  it("melaporkan jawaban terpotong ketika anggaran token habis", async () => {
    stubFetch({ badan: jawabanModel('{"usulan":[', "MAX_TOKENS") });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.equal(hasil.alasan, "TERPOTONG");
    assert.equal(hasil.data, null);
  });

  it("melaporkan penolakan model sebagai DITOLAK, bukan galat", async () => {
    stubFetch({ badan: jawabanModel("", "SAFETY") });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.equal(hasil.alasan, "DITOLAK");
  });

  it("mengenali blokir di tingkat prompt", async () => {
    stubFetch({ badan: { promptFeedback: { blockReason: "SAFETY" }, candidates: [] } });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.equal(hasil.alasan, "DITOLAK");
  });

  it("melaporkan jawaban yang bukan JSON sebagai SKEMA_GAGAL", async () => {
    stubFetch({ badan: jawabanModel("maaf, saya tidak bisa") });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.equal(hasil.alasan, "SKEMA_GAGAL");
  });

  it("melaporkan JSON yang tidak sesuai skema sebagai SKEMA_GAGAL", async () => {
    stubFetch({ badan: jawabanModel('{"usulan":"bukan larik"}') });

    const hasil = await penyediaGemini("k").chat(permintaan());
    assert.equal(hasil.alasan, "SKEMA_GAGAL");
  });
});

describe("adapter Gemini — galat", () => {
  it("menerjemahkan 400 tanpa membocorkan kunci", async () => {
    stubFetch({ status: 400, badan: { error: { message: "API key not valid" } } });

    await assert.rejects(
      () => penyediaGemini("rahasia").chat(permintaan()),
      (galat: unknown) => {
        assert.ok(galat instanceof GalatAi);
        assert.ok(galat.message.includes("Pengaturan → Kunci AI"));
        assert.ok(!galat.message.includes("GEMINI_API_KEY"));
        assert.ok(!galat.message.includes("rahasia"));
        return true;
      },
    );
  });

  it("membedakan batas pemakaian dari gangguan server", async () => {
    stubFetch({ status: 429 });
    await assert.rejects(
      () => penyediaGemini("k").chat(permintaan()),
      (g: unknown) => g instanceof GalatAi && g.message.includes("Batas pemakaian"),
    );

    stubFetch({ status: 503 });
    await assert.rejects(
      () => penyediaGemini("k").chat(permintaan()),
      (g: unknown) => g instanceof GalatAi && g.message.includes("sedang bermasalah"),
    );
  });

  it("menolak respons yang bentuknya tidak dikenal", async () => {
    stubFetch({ badan: { hasil: "aneh" } });

    const hasil = await penyediaGemini("k").chat(permintaan());
    // candidates kosong bukan bentuk asing — itu penolakan tanpa kandidat.
    assert.equal(hasil.alasan, "DITOLAK");
  });
});
