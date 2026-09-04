import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import { JENIS_BOLEH_AI } from "@/domain/kurikulum/draf-usulan";
import { LEVEL_SKEMA, SkemaDrafUsulan } from "./skema-draf-usulan";

const AKSI = readFileSync(
  "src/app/[bahasa]/(app)/usulan/[id]/aksi-draf.ts",
  "utf8",
);
const PANDUAN = readFileSync("src/lib/ai/draf-usulan.ts", "utf8");
const INTI = readFileSync("src/lib/kurikulum/draf-inti.ts", "utf8");

const bentuk = () => JSON.stringify(zodOutputFormat(SkemaDrafUsulan).schema);

describe("skema draf usulan revisi", () => {
  it("tidak ada percabangan nullable", () => {
    assert.ok(!bentuk().includes('"anyOf"'));
  });

  it("MODEL TIDAK PUNYA TEMPAT MENULIS DASAR", () => {
    /*
     * Penjaga docs/04 §9.2, dan bentuknya sengaja struktural:
     *
     *   > AI boleh menyusun butir. AI tidak pernah boleh menerbitkan dasar.
     *
     * Sebuah medan bernama `dasar_kutipan` — atau apa pun yang menampung teks
     * dasar — membuka kembali persis jalur yang seluruh fase ini ada untuk
     * menutupnya: model menempelkan kode temuan yang asli pada kalimat
     * karangannya, dan Kaprodi membaca bukti yang tidak pernah ada.
     */
    const s = bentuk();
    for (const medan of [
      "dasar_kutipan",
      "dasar_teks",
      "kutipan_temuan",
      "kutipan_dasar",
      "temuan",
      "dasar_baru",
    ]) {
      assert.ok(!s.includes(`"${medan}"`), `skema memuat medan "${medan}"`);
    }
    assert.ok(s.includes('"dasar_ref"'), "skema tidak menuntut rujukan dasar");
  });

  it("jenis butir persis daftar yang diizinkan domain", () => {
    /*
     * Dua daftar yang menyimpang diam-diam adalah bentuk kegagalan yang paling
     * sulit terlihat: skema menerima `SUB_PENSIUN`, penyaring membuangnya, dan
     * yang terbaca dosen hanyalah "3 butir dibuang" tanpa sebab yang masuk
     * akal. Karena itu skema MENGAMBIL daftarnya dari domain.
     */
    const jenis = SkemaDrafUsulan.shape.butir.element.shape.jenis;
    assert.deepEqual([...jenis.options], [...JENIS_BOLEH_AI]);
  });

  it("mempensiunkan capaian ditolak sebelum sampai ke penyaring", () => {
    const uji = (jenis: string) =>
      SkemaDrafUsulan.safeParse({
        butir: [
          {
            jenis,
            cpmk_kode: "CPMK081",
            sub_cpmk_kode: "",
            rumusan: "",
            level_bloom: "",
            cpl_kode: [],
            minggu_disarankan: [],
            alasan: "Alasan yang cukup panjang untuk dinilai Kaprodi.",
            dasar_ref: ["V:K-SUB-PENDEK:CPMK081-1"],
            kutipan_catatan: "",
          },
        ],
      }).success;

    assert.equal(uji("SUB_RUMUSAN"), true);
    assert.equal(uji("CPMK_PENSIUN"), false);
    assert.equal(uji("SUB_PENSIUN"), false);
  });

  it("daftar level lengkap terhadap kamus Bloom", () => {
    // Level yang tercecer tidak pernah dapat diusulkan model, dan tidak ada
    // satu galat pun yang menandainya.
    const diskema = new Set<string>(LEVEL_SKEMA);
    for (const l of LEVEL_BLOOM) {
      assert.ok(diskema.has(l.level), `level ${l.level} tidak ada pada skema`);
    }
    // "" adalah sentinel "tidak berlaku", bukan level.
    assert.equal(diskema.size, LEVEL_BLOOM.length + 1);
  });
});

describe("penjaga jalur penerapan draf usulan", () => {
  it("PENERAPAN MENYARING ULANG, TIDAK MEMPERCAYAI KIRIMAN PERAMBAN", () => {
    /*
     * Tanpa penyaringan kedua, seluruh penjagaan §9.2 dapat dilewati dengan
     * satu permintaan buatan tangan: butir apa pun, dasar apa pun, kutipan apa
     * pun. Pratinjau bukan otorisasi.
     */
    const terap = AKSI.slice(AKSI.indexOf("export async function terapkanDrafAi"));
    assert.match(terap, /saringDrafUsulan\(/);
    assert.match(terap, /keBentukMentah/);
  });

  it("butir hasil draf ditandai sumber AI", () => {
    // docs/01 §4.8: ditahan apa adanya setelah disahkan; asesor berhak tahu.
    assert.match(INTI, /sumber:\s*"AI"/);
  });

  it("hanya satu jalur menulis butir hasil draf", () => {
    // Jalur tulis kedua akan melewati penautan temuan evaluasi dan penandaan
    // sumber, dan tidak ada galat apa pun yang menandainya.
    assert.equal((INTI.match(/butirUsulan\.create/g) ?? []).length, 1);
    assert.ok(!/butirUsulan\.create/.test(AKSI), "aksi menulis butir sendiri");
  });

  it("penautan temuan evaluasi hanya atas temuan yang belum tertaut", () => {
    // Bila di sela pratinjau dan penerapan ada yang lebih dulu meneruskan
    // temuan yang sama, yang menang adalah usulan pertama.
    const potong = INTI.slice(INTI.indexOf("temuanEvaluasi.updateMany"));
    assert.match(potong.slice(0, 400), /usulanId:\s*null/);
  });

  it("panduan melarang mengarang dasar dan menuntut kutipan verbatim", () => {
    assert.match(PANDUAN, /TIDAK PERNAH\s+menulis dasar/);
    assert.match(PANDUAN, /verbatim/);
    assert.match(PANDUAN, /daftar\s+kosong/i);
    // Larangan keras §9.4 ditegakkan server, tetapi tetap disebut panduan agar
    // model tidak membuang kuota pada butir yang pasti dibuang.
    assert.match(PANDUAN, /Mempensiunkan CPMK atau Sub-CPMK/);
    assert.match(PANDUAN, /Ralat/);
  });
});
