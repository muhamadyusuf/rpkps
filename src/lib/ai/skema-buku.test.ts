import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  SkemaBab,
  SkemaKelengkapan,
  SkemaKerangkaBuku,
  SkemaSlideBab,
} from "./skema-buku";

const TAHAP = [
  { nama: "kerangka buku", skema: SkemaKerangkaBuku },
  { nama: "bab", skema: SkemaBab },
  { nama: "slide", skema: SkemaSlideBab },
  { nama: "kelengkapan", skema: SkemaKelengkapan },
] as const;

function json(skema: z.ZodType<unknown>): string {
  return JSON.stringify(zodOutputFormat(skema).schema);
}

describe("skema keluaran buku ajar", () => {
  it("tidak ada satu pun percabangan nullable", () => {
    // Alasannya di kepala skema-draf.ts: tiap `.nullable()` menjadi
    // `anyOf: [T, null]`, dan percabangan itulah yang membuat grammar
    // structured output ditolak — 400 "compiled grammar is too large".
    for (const { nama, skema } of TAHAP) {
      assert.ok(!json(skema).includes('"anyOf"'), `${nama} memuat percabangan`);
    }
  });

  it("METADATA TERBITAN TIDAK ADA DI SKEMA MANA PUN", () => {
    /*
     * Penjaga docs/16 P5, dan alasan keberadaannya patut ditulis panjang:
     * melarang lewat panduan saja tidak cukup, karena panduan dapat dilanggar.
     * Medan yang TIDAK ADA pada skema tidak dapat diisi model dengan cara apa
     * pun. ISBN karangan yang tercetak di halaman hak cipta ikut beredar
     * bersama bukunya dan tidak dapat ditarik kembali.
     */
    const terlarang = [
      "isbn",
      "penerbit",
      "tahun_terbit",
      "tahunTerbit",
      "edisi",
      "hak_cipta",
      "hakCipta",
      "doi",
    ];
    for (const { nama, skema } of TAHAP) {
      const bentuk = json(skema);
      for (const medan of terlarang) {
        assert.ok(
          !bentuk.includes(`"${medan}"`),
          `skema ${nama} memuat medan terlarang "${medan}"`,
        );
      }
    }
  });

  it("keluaran bab menerima bentuk yang diharapkan", () => {
    const contoh = {
      uraian: "1. Pengantar\nParagraf.",
      studi_kasus: "",
      ringkasan: "Ringkasan bab.",
      latihan: [{ soal: "Jelaskan A.", kunci: "A adalah…", bloom: "C2" }],
      sitiran: [1, 3],
    };
    assert.deepEqual(SkemaBab.parse(contoh), contoh);
  });

  it("level Bloom di luar taksonomi ditolak skema", () => {
    const salah = {
      uraian: "x",
      studi_kasus: "",
      ringkasan: "",
      latihan: [{ soal: "?", kunci: "", bloom: "C9" }],
      sitiran: [],
    };
    assert.equal(SkemaBab.safeParse(salah).success, false);
  });
});

describe("panduan tugas buku ajar", () => {
  const sumber = readFileSync("src/lib/ai/buku-ajar.ts", "utf8");

  it("tidak menyediakan perulangan 'susun semua bab' di server", () => {
    // docs/16 §3.2: perulangannya milik antarmuka. Satu Server Action yang
    // menunggu empat belas panggilan menabrak batas waktu, dan bab yang sudah
    // berhasil ikut hilang bersamanya.
    assert.ok(!/export async function susunSemua/.test(sumber));
  });

  it("tiap tahap membuka kredensial dosen sendiri, tanpa klien modul", () => {
    /*
     * Angkanya dipasang di sini dengan sengaja: tahap baru yang lupa membuka
     * kredensialnya sendiri akan memakai kunci yang salah, dan tagihannya
     * salah alamat. Yang dihitung SETIAP tugas AI, bukan hanya yang bernama
     * `susun*` — `suntingBab` dan `tinjauNaskah` (docs/19) juga membuka kunci
     * dosen, dan justru penamaan yang berbeda itulah yang membuat pemindai
     * berbasis nama mudah kebobolan.
     */
    const tahap = sumber.match(/^export async function (susun|sunting|tinjau)\w+/gm) ?? [];
    assert.equal(tahap.length, 9, tahap.join(", "));
    assert.equal((sumber.match(/await pakaiKredensial\(/g) ?? []).length, 9);
    // Klien SDK pada variabel modul akan mengabaikan kunci dosen berikutnya
    // dan menagihkannya ke alamat yang salah.
    assert.ok(!/^const \w+ = buatPenyedia\(/m.test(sumber));
  });

  it("panduan dasar tidak menyebut apa pun yang berubah antarpemanggilan", () => {
    const dasar = sumber.slice(
      sumber.indexOf("const PANDUAN_DASAR"),
      sumber.indexOf("/** Tahap 1"),
    );
    // Blok stabil yang menyebut bahasa, nama dosen, atau mata kuliah akan
    // membelah cache prompt tanpa alasan.
    for (const kata of ["${", "bahasa Indonesia", "bahasa Inggris"]) {
      assert.ok(!dasar.includes(kata), `PANDUAN_DASAR menyebut "${kata}"`);
    }
  });
});
