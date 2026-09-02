import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MEDAN_BOLEH } from "./medan-en";

/**
 * Penjaga `MEDAN_BOLEH` (docs/11 §8.6).
 *
 * Penerapan terjemahan menulis satu `UPDATE … FROM (VALUES …)` per kolom
 * supaya jumlah kueri tidak ikut membesar bersama dokumen. Harganya: nama
 * tabel dan kolom ditulis tangan, dan `Prisma.raw` tidak akan pernah
 * mengeluhkan nama yang salah — ia hanya menghasilkan galat SQL saat
 * dijalankan, pada dokumen sungguhan, milik dosen sungguhan.
 *
 * Karena itu penjaganya tekstual: setiap nama dicocokkan dengan
 * `schema.prisma`. Mengganti `@map` sebuah kolom tanpa memperbarui berkas ini
 * gagal di sini, bukan di layar dosen.
 */

const SKEMA = readFileSync("prisma/schema.prisma", "utf8");

/** Model Prisma yang namanya di-`@map` ke tabel tertentu. */
function blokModel(nama: string): string {
  const m = SKEMA.match(new RegExp(`^model ${nama} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${nama} tidak ada di schema.prisma`);
  return m[1];
}

/** Nama model Prisma dari nama properti klien (`butirKisiKisi` → `ButirKisiKisi`). */
function namaModel(properti: string): string {
  return properti[0].toUpperCase() + properti.slice(1);
}

describe("peta nama SQL kolom terjemahan", () => {
  for (const [properti, izin] of Object.entries(MEDAN_BOLEH)) {
    const blok = blokModel(namaModel(properti));

    it(`${properti} menunjuk tabel "${izin.tabel}"`, () => {
      const map = blok.match(/@@map\("([^"]+)"\)/);
      const tabel = map ? map[1] : properti;
      assert.equal(izin.tabel, tabel);
    });

    it(`${properti} memakai kolom kunci "id" tanpa @map`, () => {
      // Kueri jamaknya membandingkan `t.id = v.id`. Kunci yang di-`@map`
      // membuat SQL itu menunjuk kolom yang tidak ada.
      const baris = blok.match(/^\s+id\s+String\s+@id[^\n]*/m);
      assert.ok(baris, `${properti} tidak punya kunci id String`);
      assert.ok(!baris[0].includes("@map"), `id ${properti} di-@map: ${baris[0].trim()}`);
    });

    for (const [medan, kolom] of Object.entries(izin.kolom)) {
      it(`${properti}.${medan} → "${kolom}"`, () => {
        const baris = blok.match(new RegExp(`^\\s+${medan}\\s+\\S+([^\\n]*)`, "m"));
        assert.ok(baris, `${medan} tidak ada pada model ${namaModel(properti)}`);
        const map = baris[1].match(/@map\("([^"]+)"\)/);
        assert.equal(map ? map[1] : medan, kolom);
      });
    }
  }

  it("hanya kolom berakhiran En yang boleh ditulis", () => {
    // Daftar putih ini adalah satu-satunya yang berdiri antara alamat kiriman
    // peramban dan sebuah UPDATE. Kolom bahasa Indonesia yang menyelinap ke
    // sini berarti terjemahan dapat menimpa naskah yang sah.
    for (const [properti, izin] of Object.entries(MEDAN_BOLEH)) {
      for (const [medan, kolom] of Object.entries(izin.kolom)) {
        assert.ok(medan.endsWith("En"), `${properti}.${medan} bukan medan terjemahan`);
        assert.ok(kolom.endsWith("_en"), `${properti}.${kolom} bukan kolom terjemahan`);
      }
    }
  });

  it("nama tabel dan kolom aman dimasukkan ke SQL apa adanya", () => {
    // Keduanya masuk lewat `Prisma.raw`, jadi bentuknya harus dipastikan di
    // sini — bukan dipercayakan pada disiplin penyunting berikutnya.
    const aman = /^[a-z][a-z0-9_]*$/;
    for (const izin of Object.values(MEDAN_BOLEH)) {
      assert.match(izin.tabel, aman);
      for (const kolom of Object.values(izin.kolom)) assert.match(kolom, aman);
    }
  });
});
