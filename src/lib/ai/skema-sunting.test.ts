import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SkemaSinopsis, SkemaSuntingBab, SkemaTinjauNaskah } from "./skema-sunting";

const SUMBER = readFileSync("src/lib/ai/buku-ajar.ts", "utf8");
const AKSI = readFileSync(
  "src/app/[bahasa]/(app)/bahan-ajar/[id]/aksi-sunting.ts",
  "utf8",
);

const TAHAP = [
  { nama: "sunting bab", skema: SkemaSuntingBab },
  { nama: "tinjau naskah", skema: SkemaTinjauNaskah },
  { nama: "sinopsis", skema: SkemaSinopsis },
] as const;

describe("skema penyuntingan naskah", () => {
  it("tidak ada percabangan nullable", () => {
    for (const { nama, skema } of TAHAP) {
      const bentuk = JSON.stringify(zodOutputFormat(skema).schema);
      assert.ok(!bentuk.includes('"anyOf"'), nama);
    }
  });

  it("MODEL TIDAK PUNYA TEMPAT MENULIS ULANG NASKAH", () => {
    /*
     * Penjaga docs/19 E1, dan bentuknya sengaja struktural. Skema penyuntingan
     * hanya menerima pasangan kutipan–pengganti–alasan; sebuah medan bernama
     * `uraian`, `naskah`, atau `bab_baru` akan membuka kembali persis jalur
     * yang tahap ini ada untuk menutupnya — model menulis, dosen tidak pernah
     * membaca.
     */
    const bentuk = JSON.stringify(zodOutputFormat(SkemaSuntingBab).schema);
    for (const medan of ["uraian", "naskah", "bab_baru", "teks_lengkap", "hasil"]) {
      assert.ok(!bentuk.includes(`"${medan}"`), `skema memuat medan "${medan}"`);
    }
    assert.ok(bentuk.includes('"kutipan"'), "skema tidak menuntut kutipan");
  });

  it("skema sinopsis tidak punya satu pun medan metadata terbitan", () => {
    // docs/16 P5 tetap berlaku: sinopsis adalah tulisan, ISBN bukan.
    const bentuk = JSON.stringify(zodOutputFormat(SkemaSinopsis).schema);
    for (const medan of ["isbn", "penerbit", "tahun", "harga", "edisi"]) {
      assert.ok(!bentuk.includes(`"${medan}"`), medan);
    }
  });

  it("jenis usulan terbatas pada lima yang dikenal skema basis data", () => {
    const sah = {
      usulan: [{ kutipan: "a", usul: "b", alasan: "c", jenis: "BAHASA" }],
    };
    assert.ok(SkemaSuntingBab.safeParse(sah).success);
    assert.equal(
      SkemaSuntingBab.safeParse({
        usulan: [{ kutipan: "a", usul: "b", alasan: "c", jenis: "SELERA" }],
      }).success,
      false,
    );
  });
});

describe("penjaga alur penyuntingan", () => {
  it("TIDAK ADA AKSI TERIMA SEMUA", () => {
    /*
     * docs/19 E2, ditolak dengan sadar. Begitu tombol itu ada, ia yang akan
     * dipakai — dan penandaan "menerima usulan dihitung sebagai suntingan
     * manusia" (E3) langsung kehilangan dasarnya, karena tidak ada lagi
     * pembacaan yang terjadi.
     */
    assert.ok(!/terimaSemua|setujuiSemua|applyAll/i.test(AKSI));
  });

  it("hanya satu jalur yang MENULIS uraian bab", () => {
    /*
     * Yang dijaga penulisan, bukan penyebutan: `uraian` juga dibaca untuk
     * dikirim ke model, dan itu memang seharusnya. Yang tidak boleh bertambah
     * adalah tempat yang menuliskannya kembali ke basis data — tugas AI
     * menyimpan baris usulan, dan yang mengubah naskah hanyalah keputusan
     * dosen.
     */
    const penulisan = AKSI.match(/data:\s*\{[^}]*\buraian:/g) ?? [];
    assert.equal(penulisan.length, 1, "lebih dari satu tempat menulis uraian bab");
    assert.ok(
      AKSI.includes("export async function putuskanUsulan"),
      "jalur keputusan tidak ditemukan",
    );
  });

  it("usulan yang kutipannya sudah berubah tidak dipaksakan", () => {
    // Mengganti teks yang sudah disunting dosen berarti menimpa suntingannya
    // dengan usulan atas naskah lama.
    assert.match(AKSI, /KEDALUWARSA/);
    assert.match(AKSI, /includes\(usulan\.kutipan\)/);
  });

  it("menerima usulan mengisi penanda suntingan manusia", () => {
    // docs/19 E3 — sah hanya selama tidak ada tombol terima-semua.
    assert.match(AKSI, /disuntingPada: new Date\(\)/);
  });

  it("panduan menyuruh model menyalin kutipan persis", () => {
    const panduan = SUMBER.slice(
      SUMBER.indexOf("const PANDUAN_SUNTING = `"),
      SUMBER.indexOf("`;", SUMBER.indexOf("const PANDUAN_SUNTING = `")),
    );
    assert.match(panduan, /SALIN PERSIS/);
    assert.match(panduan, /daftar kosong/i);
    // Yang sudah dihitung mesin tidak boleh diminta ulang ke model.
    assert.match(panduan, /sudah dikerjakan mesin/i);
  });
});
