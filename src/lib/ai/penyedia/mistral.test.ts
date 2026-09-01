import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";

import { penyediaMistral } from "./mistral";
import { GalatAi } from "../galat";

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

/**
 * Varian stubFetch yang menjawab berbeda per endpoint. Diperlukan sejak
 * adapter menanyakan katalog model pada galat 403/404: satu jawaban untuk
 * semua URL tidak dapat membedakan "model salah" dari "kunci tak berwenang".
 */
function stubPerUrl(peta: Record<string, { status?: number; badan?: unknown }>) {
  const terkirim: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    terkirim.push({ url, init });
    const cocok = Object.entries(peta).find(([jalur]) => url.includes(jalur));
    const jawab = cocok?.[1] ?? { status: 500 };
    return new Response(JSON.stringify(jawab.badan ?? {}), {
      status: jawab.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return terkirim;
}

function permintaan() {
  return {
    model: "mistral-large-latest",
    panduan: "Panduan yang stabil.",
    permintaan: "Konteks kurikulum.",
    skema: Skema,
    maxTokens: 4000,
  };
}

function jawabanModel(isi: string, finishReason = "stop") {
  return {
    choices: [{ finish_reason: finishReason, message: { content: isi } }],
    usage: { prompt_tokens: 120, completion_tokens: 40 },
  };
}

describe("adapter Mistral — bentuk permintaan", () => {
  it("mengirim skema JSON strict beserta kunci pada header Authorization", async () => {
    const terkirim = stubFetch({ badan: jawabanModel('{"usulan":[]}') });

    await penyediaMistral("kunci-uji").chat(permintaan());

    assert.equal(terkirim.length, 1);
    assert.equal(terkirim[0].url, "https://api.mistral.ai/v1/chat/completions");

    const header = terkirim[0].init.headers as Record<string, string>;
    assert.equal(header.Authorization, "Bearer kunci-uji");

    const badan = JSON.parse(terkirim[0].init.body as string);
    assert.equal(badan.response_format.type, "json_schema");
    assert.equal(badan.response_format.json_schema.strict, true);

    const skema = badan.response_format.json_schema.schema;
    // Mode strict menuntut keduanya; $schema tidak diharapkan Mistral.
    assert.equal(skema.additionalProperties, false);
    assert.deepEqual(skema.required, ["usulan"]);
    assert.equal(skema.$schema, undefined);
  });

  it("menaruh panduan sebagai pesan system, terpisah dari permintaan", async () => {
    const terkirim = stubFetch({ badan: jawabanModel('{"usulan":[]}') });

    await penyediaMistral("kunci-uji").chat(permintaan());

    const badan = JSON.parse(terkirim[0].init.body as string);
    assert.deepEqual(
      badan.messages.map((m: { role: string }) => m.role),
      ["system", "user"],
    );
    assert.equal(badan.messages[0].content, "Panduan yang stabil.");
  });
});

describe("adapter Mistral — pembacaan jawaban", () => {
  it("mengembalikan data yang lolos skema beserta pemakaian token", async () => {
    stubFetch({ badan: jawabanModel('{"usulan":[{"kode":"CPMK081-1"}]}') });

    const hasil = await penyediaMistral("k").chat(permintaan());

    assert.equal(hasil.alasan, "SELESAI");
    assert.deepEqual(hasil.data, { usulan: [{ kode: "CPMK081-1" }] });
    assert.equal(hasil.pemakaian?.tokenMasuk, 120);
    assert.equal(hasil.pemakaian?.tokenKeluar, 40);
    // Mistral tidak melaporkan cache pada endpoint ini.
    assert.equal(hasil.pemakaian?.tokenCacheBaca, null);
  });

  it("menandai SKEMA_GAGAL — bukan melempar — saat JSON tidak sesuai skema", async () => {
    stubFetch({ badan: jawabanModel('{"usulan":[{"salah":"bentuk"}]}') });

    const hasil = await penyediaMistral("k").chat(permintaan());

    assert.equal(hasil.alasan, "SKEMA_GAGAL");
    assert.equal(hasil.data, null);
  });

  it("menandai SKEMA_GAGAL saat jawaban bukan JSON sama sekali", async () => {
    stubFetch({ badan: jawabanModel("Maaf, saya tidak dapat membantu.") });

    const hasil = await penyediaMistral("k").chat(permintaan());
    assert.equal(hasil.alasan, "SKEMA_GAGAL");
  });

  it("mengenali jawaban terpotong dari finish_reason", async () => {
    for (const alasan of ["length", "model_length"]) {
      stubFetch({ badan: jawabanModel('{"usulan":[', alasan) });
      const hasil = await penyediaMistral("k").chat(permintaan());
      assert.equal(hasil.alasan, "TERPOTONG", `finish_reason=${alasan}`);
    }
  });
});

describe("adapter Mistral — galat", () => {
  it("menerjemahkan 401 tanpa membocorkan kunci", async () => {
    stubFetch({ status: 401, badan: { message: "Unauthorized" } });

    await assert.rejects(
      () => penyediaMistral("kunci-rahasia").chat(permintaan()),
      (galat: unknown) => {
        assert.ok(galat instanceof GalatAi);
        // Sejak Mode A (docs/08) kunci milik dosen, bukan env: pesan harus
        // mengarahkan ke halaman pengaturannya, bukan ke MISTRAL_API_KEY.
        assert.match(galat.message, /Pengaturan → Kunci AI/);
        assert.doesNotMatch(galat.message, /MISTRAL_API_KEY/);
        assert.doesNotMatch(galat.message, /kunci-rahasia/);
        return true;
      },
    );
  });

  it("membedakan batas pemakaian dari gangguan server", async () => {
    stubFetch({ status: 429 });
    await assert.rejects(
      () => penyediaMistral("k").chat(permintaan()),
      /Batas pemakaian Mistral/,
    );

    stubFetch({ status: 503 });
    await assert.rejects(() => penyediaMistral("k").chat(permintaan()), /bermasalah/);
  });

  it("menyebut model yang sah saat 403, bukan sekadar kode statusnya", async () => {
    // Ini kasus yang membuat dosen buntu: kuncinya BENAR ada di akunnya, jadi
    // pesan "403" saja membuatnya memeriksa hal yang sudah benar. Yang perlu
    // dibaca adalah alasan Mistral dan daftar model yang boleh dipakai kunci.
    const terkirim = stubPerUrl({
      "/v1/chat/completions": {
        status: 403,
        badan: { message: "Model not available for your subscription" },
      },
      "/v1/models": {
        badan: { data: [{ id: "mistral-small-latest" }, { id: "ministral-8b-latest" }] },
      },
    });

    await assert.rejects(
      () => penyediaMistral("kunci-uji").chat(permintaan()),
      (galat: unknown) => {
        assert.ok(galat instanceof GalatAi);
        assert.match(galat.message, /mistral-large-latest/);
        assert.match(galat.message, /Model not available for your subscription/);
        // Nama model diurutkan agar pesannya stabil antar panggilan.
        assert.match(galat.message, /ministral-8b-latest, mistral-small-latest/);
        return true;
      },
    );

    // Katalog hanya ditanya pada jalur galat, sekali.
    assert.equal(terkirim.filter((t) => t.url.includes("/v1/models")).length, 1);
  });

  it("mengarahkan ke paket akun, bukan ke nama model, saat katalog ikut ditolak", async () => {
    // Kunci yang tidak berwenang atas SATU model pun bukan salah ketik nama
    // model: yang salah paket/langganan atau cakupan kunci. Menyuruh dosen
    // "pilih model lain" dalam keadaan ini mengirimnya ke jalan buntu.
    stubPerUrl({
      "/v1/chat/completions": { status: 403, badan: { message: "Forbidden" } },
      "/v1/models": { status: 403, badan: { message: "Forbidden" } },
    });

    await assert.rejects(
      () => penyediaMistral("kunci-uji").chat(permintaan()),
      (galat: unknown) => {
        assert.ok(galat instanceof GalatAi);
        assert.match(galat.message, /tidak berwenang atas satu model pun/);
        assert.match(galat.message, /paket\/langganan/);
        assert.match(galat.message, /cakupan \(scope\)/);
        return true;
      },
    );
  });

  it("menyensor kunci yang dikutip balik oleh penyedia", async () => {
    // Badan galat berasal dari luar dan tidak dijamin bersih. Aturan docs/08:
    // yang boleh keluar hanya empat huruf terakhir.
    stubPerUrl({
      "/v1/chat/completions": {
        status: 401,
        badan: { message: "Invalid key: kunci-rahasia-abcd" },
      },
    });

    await assert.rejects(
      () => penyediaMistral("kunci-rahasia-abcd").chat(permintaan()),
      (galat: unknown) => {
        assert.ok(galat instanceof GalatAi);
        assert.doesNotMatch(galat.message, /kunci-rahasia-abcd/);
        assert.match(galat.message, /•••abcd/);
        return true;
      },
    );
  });

  it("tidak menanyakan katalog model pada galat yang bukan soal model", async () => {
    const terkirim = stubPerUrl({
      "/v1/chat/completions": { status: 429, badan: { message: "Rate limit" } },
    });

    await assert.rejects(
      () => penyediaMistral("k").chat(permintaan()),
      /Batas pemakaian Mistral/,
    );
    assert.equal(terkirim.filter((t) => t.url.includes("/v1/models")).length, 0);
  });

  it("menolak respons yang bentuknya tidak dikenal", async () => {
    stubFetch({ badan: { hasil: "bentuk lain" } });
    await assert.rejects(
      () => penyediaMistral("k").chat(permintaan()),
      /tidak dapat dibaca/,
    );
  });
});
