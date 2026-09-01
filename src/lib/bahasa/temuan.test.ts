import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { temuanId } from "@/kamus/temuan-id";
import { temuanEn } from "@/kamus/temuan-en";
import { id } from "@/kamus/id";
import { en } from "@/kamus/en";
import { teksTemuan } from "./temuan";

/** Penanda `{nama}` pada sebuah pola. */
function penanda(pola: string): Set<string> {
  return new Set([...pola.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

describe("kamus temuan", () => {
  it("kedua bahasa memakai penanda yang sama persis", () => {
    // Penanda yang berbeda nama lolos `tsc` — tipenya sama-sama `string`.
    // Gejalanya baru muncul di layar berbahasa Inggris sebagai "{daftar}"
    // yang tidak pernah terisi.
    for (const kode of Object.keys(temuanId) as (keyof typeof temuanId)[]) {
      const a = temuanId[kode] as { pesan: string; saran?: string };
      const b = temuanEn[kode] as { pesan: string; saran?: string };
      assert.deepEqual(penanda(a.pesan), penanda(b.pesan), `${kode}.pesan`);
      assert.deepEqual(
        penanda(a.saran ?? ""),
        penanda(b.saran ?? ""),
        `${kode}.saran`,
      );
    }
  });

  it("tidak ada kalimat yang tertinggal belum diterjemahkan", () => {
    const sama: string[] = [];
    for (const kode of Object.keys(temuanId) as (keyof typeof temuanId)[]) {
      const a = temuanId[kode] as { pesan: string };
      const b = temuanEn[kode] as { pesan: string };
      // Kalimat yang identik hanya wajar bila isinya semata penanda dan angka.
      if (a.pesan === b.pesan && /[a-z]{4}/.test(a.pesan.replace(/\{\w+\}/g, ""))) {
        sama.push(kode);
      }
    }
    assert.deepEqual(sama, [], `masih berbahasa Indonesia di en: ${sama.join(", ")}`);
  });
});

/** Berkas .ts di bawah sebuah folder, tanpa uji. */
function berkasDomain(akar: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(akar)) {
    const jalur = join(akar, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasDomain(jalur));
    else if (nama.endsWith(".ts") && !nama.endsWith(".test.ts")) hasil.push(jalur);
  }
  return hasil;
}

describe("kode temuan yang dihasilkan domain", () => {
  it("setiap kode punya kalimatnya di kedua kamus", () => {
    // Penjaga yang tidak dapat diberikan tipe: `kode` sebuah temuan adalah
    // string biasa, jadi aturan baru yang lupa menuliskan kalimatnya akan
    // lolos `tsc` dan muncul di layar dosen sebagai "B7-ENTAH-APA".
    const dipakai = new Set<string>();
    for (const berkas of berkasDomain("src/domain")) {
      const isi = readFileSync(berkas, "utf8");
      // Hanya yang benar-benar temuan validator: penandanya `tingkat:` di
      // objek yang sama. `draf-usulan.ts` juga memakai `kode:` berhuruf besar
      // untuk galat penerapan draf AI — bentuk lain, ruang pesan lain.
      for (const cocok of isi.matchAll(/kode:\s*"([A-Z][A-Z0-9-]{4,})"/g)) {
        const jendela = isi.slice(
          Math.max(0, cocok.index - 300),
          cocok.index + 300,
        );
        if (jendela.includes("tingkat:")) dipakai.add(cocok[1]);
      }
      // Bentuk `tolak("U-…", …)` dan `tandai("U-…", …)`.
      for (const [, kode] of isi.matchAll(/\b(?:tolak|tandai)\(\s*"([A-Z][A-Z0-9-]{4,})"/g)) {
        dipakai.add(kode);
      }
      // Bentuk ternary: `kode: x ? "L1-KELEBIHAN" : "L1-KEKURANGAN"`.
      for (const [, a, b] of isi.matchAll(
        /kode:\s*[^,\n]*\?\s*"([A-Z][A-Z0-9-]{4,})"\s*:\s*"([A-Z][A-Z0-9-]{4,})"/g,
      )) {
        dipakai.add(a);
        dipakai.add(b);
      }
    }

    assert.ok(dipakai.size >= 100, `hanya ${dipakai.size} kode terbaca — pemindainya rusak?`);
    for (const kode of dipakai) {
      assert.ok(kode in temuanId, `temuan-id.ts tidak punya ${kode}`);
      assert.ok(kode in temuanEn, `temuan-en.ts tidak punya ${kode}`);
    }
  });
});

describe("perakit kalimat temuan", () => {
  it("mengisi penanda dari params", () => {
    const t = { kode: "B6-MINGGU-GANDA", params: { daftar: "3, 7" } };
    assert.equal(teksTemuan(t, id).pesan, "Minggu 3, 7 muncul lebih dari sekali.");
    assert.equal(teksTemuan(t, en).pesan, "Week 3, 7 appears more than once.");
  });

  it("durasi bertanda menjadi kata dalam bahasa pembacanya", () => {
    const t = { kode: "L1-TANPA-PAGU", params: { total: { menit: 150 } } };
    assert.match(teksTemuan(t, id).pesan, /2 jam 30 menit/);
    assert.match(teksTemuan(t, en).pesan, /2 hours 30 minutes/);
  });

  it("kode tak dikenal mengembalikan kodenya, bukan baris kosong", () => {
    assert.equal(teksTemuan({ kode: "B7-ENTAH-APA" }, id).pesan, "B7-ENTAH-APA");
  });

  it("saran ikut terisi bila ada", () => {
    const t = { kode: "B6-MINGGU-HILANG", params: { daftar: "5" } };
    assert.equal(teksTemuan(t, id).saran, "Minggu ujian tetap harus muncul sebagai baris bernomor.");
    assert.equal(teksTemuan({ kode: "B-DESKRIPSI" }, id).saran, undefined);
  });
});
