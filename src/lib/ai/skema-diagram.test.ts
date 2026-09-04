import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { JENIS_MERMAID } from "@/domain/bahan-ajar/mermaid-aman";
import { PALET, TEBAL_GARIS, UKURAN_TEKS_MINIMAL } from "@/domain/bahan-ajar/gaya-svg";
import { SkemaDiagram } from "./skema-diagram";

const SUMBER = readFileSync("src/lib/ai/buku-ajar.ts", "utf8");

/** Panduan tahap diagram, sebagaimana benar-benar dirakit saat modul dimuat. */
async function panduanDiagram(): Promise<string> {
  // Diimpor dinamis karena `buku-ajar.ts` adalah `server-only`; yang dibaca di
  // sini hanyalah teks panduannya lewat berkas sumbernya sendiri.
  const awal = SUMBER.indexOf("const PANDUAN_DIAGRAM = `");
  const akhir = SUMBER.indexOf("`;", awal);
  assert.ok(awal > 0 && akhir > awal, "PANDUAN_DIAGRAM tidak ditemukan");
  return SUMBER.slice(awal, akhir);
}

describe("skema keluaran diagram", () => {
  it("tidak ada percabangan nullable", () => {
    assert.ok(!JSON.stringify(zodOutputFormat(SkemaDiagram).schema).includes('"anyOf"'));
  });

  it("MODEL TIDAK PERNAH DIMINTA MENGEMBALIKAN PIKSEL", () => {
    /*
     * Penjaga docs/17 I1. Diagram disimpan sebagai KODE; PNG-nya dirasterkan
     * peramban dari kode itu. Sebuah medan bernama `png`, `base64`, atau
     * `gambar_data` pada skema ini akan membuka kembali persis jalur yang
     * fitur ini ada untuk menghindarinya — gambar bikinan model, dengan label
     * yang menyerupai huruf.
     */
    const bentuk = JSON.stringify(zodOutputFormat(SkemaDiagram).schema);
    for (const medan of ["png", "base64", "data", "gambar_data", "image", "url"]) {
      assert.ok(!bentuk.includes(`"${medan}"`), `skema memuat medan "${medan}"`);
    }
  });

  it("hanya dua bentuk yang diterima", () => {
    const sah = { judul: "A", alt: "B", letak: "C", bentuk: "SVG", kode: "<svg/>" };
    assert.ok(SkemaDiagram.safeParse({ gambar: [sah] }).success);
    assert.equal(
      SkemaDiagram.safeParse({ gambar: [{ ...sah, bentuk: "RASTER" }] }).success,
      false,
    );
  });
});

describe("panduan tahap diagram", () => {
  it("menyebut cetakan gaya yang SAMA dengan yang ditegakkan domain", async () => {
    /*
     * Panduan dan penegaknya harus sepakat. Bila keduanya ditulis terpisah,
     * suatu hari palet di domain berubah dan panduan tetap menyuruh model
     * memakai warna lama — hasilnya seluruh diagram ditolak, dan tidak ada
     * yang tahu mengapa. Karena itu panduannya MENGAMBIL angka dari konstanta
     * domain, dan uji ini menjaga sambungan itu tetap ada.
     */
    const panduan = await panduanDiagram();
    assert.match(panduan, /\$\{\[\.\.\.PALET\]/);
    assert.match(panduan, /\$\{\[\.\.\.TEBAL_GARIS\]/);
    assert.match(panduan, /\$\{UKURAN_TEKS_MINIMAL\}/);
    assert.match(panduan, /\$\{JENIS_MERMAID\.join/);

    // Dan konstanta itu memang bernilai seperti yang dijanjikan docs/17 §4.3.
    assert.ok(PALET.has("#111827") && PALET.has("#1d4ed8"));
    assert.deepEqual([...TEBAL_GARIS], ["1.5", "2.5"]);
    assert.equal(UKURAN_TEKS_MINIMAL, 12);
    assert.ok(JENIS_MERMAID.includes("flowchart"));
  });

  it("melarang apa yang memang ditolak pemeriksa", async () => {
    const panduan = (await panduanDiagram()).toLowerCase();
    for (const larangan of ["gradien", "foreignobject", "click", "%%{init", "transparansi"]) {
      assert.ok(panduan.includes(larangan), `panduan tidak menyebut "${larangan}"`);
    }
  });

  it("menyatakan bab boleh tanpa gambar", async () => {
    // Tanpa kalimat ini, model akan selalu mengarang gambar demi mengisi
    // daftar — dan diagram yang dipaksakan lebih buruk daripada halaman
    // tanpa gambar.
    assert.match(await panduanDiagram(), /daftar kosong/i);
  });
});
