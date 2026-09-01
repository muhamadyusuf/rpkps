import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { id } from "@/kamus/id";
import { en } from "@/kamus/en";
import { pesanZod, telusuriKamus } from "./zod";

function galat(pesan: string): ZodError {
  return new ZodError([{ code: "custom", path: [], message: pesan }]);
}

describe("pesan Zod", () => {
  it("menerjemahkan kunci berawalan @", () => {
    assert.equal(pesanZod(galat("@aksi.periksa.pilihMk"), id), id.aksi.periksa.pilihMk);
    assert.equal(pesanZod(galat("@aksi.periksa.pilihMk"), en), en.aksi.periksa.pilihMk);
  });

  it("melewatkan pesan bawaan Zod apa adanya", () => {
    // Pesan yang tidak kita tulis sendiri — "Invalid input: expected string"
    // dan kerabatnya — harus tetap utuh, bukan berubah jadi kalimat generik.
    assert.equal(pesanZod(galat("Invalid input"), id), "Invalid input");
  });

  it("kunci yang tidak ada jatuh ke cadangan, bukan ke layar", () => {
    assert.equal(pesanZod(galat("@aksi.periksa.tiada"), id), id.aksi.umum.dataTidakValid);
    assert.equal(
      pesanZod(galat("@aksi.periksa.tiada"), id, id.aksi.umum.masukanTidakSah),
      id.aksi.umum.masukanTidakSah,
    );
  });

  it("telusuriKamus menolak simpul yang bukan string", () => {
    assert.equal(telusuriKamus(id, "aksi.periksa"), null);
    assert.equal(telusuriKamus(id, "aksi.periksa.pilihMk.lagi"), null);
  });
});

/** Semua berkas .ts/.tsx di bawah sebuah folder. */
function berkasTs(akar: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(akar)) {
    const jalur = join(akar, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasTs(jalur));
    else if (/\.tsx?$/.test(nama)) hasil.push(jalur);
  }
  return hasil;
}

describe("kunci @ pada skema Zod", () => {
  it("setiap kunci yang dipakai ada di kedua kamus", () => {
    // Penjaga yang tidak dapat diberikan tipe: kunci itu hidup sebagai string
    // di dalam skema, jadi salah ketik tidak akan ditangkap `tsc` — ia hanya
    // muncul sebagai "Data tidak valid." di layar dosen, berbulan-bulan.
    const dipakai = new Set<string>();
    for (const berkas of berkasTs("src/app")) {
      const isiBerkas = readFileSync(berkas, "utf8");
      for (const [, kunci] of isiBerkas.matchAll(/"@([\w.]+)"/g)) dipakai.add(kunci);
    }

    assert.ok(dipakai.size >= 20, `hanya ${dipakai.size} kunci terbaca — pemindainya rusak?`);
    for (const kunci of dipakai) {
      assert.ok(telusuriKamus(id, kunci), `id.ts tidak punya ${kunci}`);
      assert.ok(telusuriKamus(en, kunci), `en.ts tidak punya ${kunci}`);
    }
  });
});
