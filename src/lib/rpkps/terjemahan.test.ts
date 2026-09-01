import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga invarian docs/11 §5.3.
 *
 * `simpanPertemuan` dan `simpanTugas` mengganti SELURUH isi baris. Sebuah
 * kolom `*En` yang ada di skema tetapi tidak ikut di muatan simpan akan
 * terhapus setiap kali dosen menyunting tab Indonesia — tanpa galat, tanpa
 * pesan, tanpa jejak. `tsc` tidak dapat melihatnya: Prisma menerima `data`
 * parsial dengan senang hati.
 *
 * Jadi penjaganya harus tekstual: setiap kolom `*En` pada model isi RPKPS
 * wajib disebut di berkas aksi yang menulis modelnya.
 */

const SKEMA = readFileSync("prisma/schema.prisma", "utf8");

/** Kolom `*En` milik sebuah model Prisma. */
function kolomEn(model: string): string[] {
  const m = SKEMA.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${model} tidak ditemukan di schema.prisma`);
  return [...m[1].matchAll(/^\s+(\w+En)\s/gm)].map((x) => x[1]);
}

const PENULIS: { model: string; berkas: string }[] = [
  { model: "Pertemuan", berkas: "src/app/[bahasa]/(app)/rpkps/aksi.ts" },
  { model: "AktivitasBelajar", berkas: "src/app/[bahasa]/(app)/rpkps/aksi.ts" },
  { model: "Indikator", berkas: "src/app/[bahasa]/(app)/rpkps/aksi.ts" },
  { model: "Tugas", berkas: "src/app/[bahasa]/(app)/rpkps/[id]/tugas/aksi.ts" },
  { model: "KriteriaTugas", berkas: "src/app/[bahasa]/(app)/rpkps/[id]/tugas/aksi.ts" },
  { model: "LinimasaTugas", berkas: "src/app/[bahasa]/(app)/rpkps/[id]/tugas/aksi.ts" },
  { model: "KisiKisi", berkas: "src/app/[bahasa]/(app)/rpkps/[id]/kisi-kisi/aksi.ts" },
  { model: "ButirKisiKisi", berkas: "src/app/[bahasa]/(app)/rpkps/[id]/kisi-kisi/aksi.ts" },
  { model: "KomponenNilai", berkas: "src/lib/rpkps/komponen-inti.ts" },
];

describe("medan Inggris ikut dalam muatan simpan", () => {
  for (const { model, berkas } of PENULIS) {
    it(`${model} — seluruh kolom *En disebut di ${berkas.split("/").pop()}`, () => {
      const kolom = kolomEn(model);
      assert.ok(kolom.length > 0, `${model} tidak punya kolom *En — daftar penjaga basi?`);
      const isi = readFileSync(berkas, "utf8");
      for (const nama of kolom) {
        assert.ok(
          isi.includes(nama),
          `${berkas} tidak menyebut ${model}.${nama} — menyunting bahasa ` +
            `Indonesia akan menghapus terjemahannya tanpa satu pesan pun`,
        );
      }
    });
  }
});

describe("identitas komponen nilai", () => {
  it("namaEn tidak menjadi bagian kunci unik", () => {
    // Kalau `nama_en` ikut ke @@unique, mengubah terjemahan melepas SELURUH
    // tautan asesmen — bencana yang justru dicegah komponen-nilai.ts.
    const m = SKEMA.match(/^model KomponenNilai \{([\s\S]*?)^\}/m);
    assert.ok(m);
    const unik = m[1].match(/@@unique\(\[([^\]]+)\]\)/);
    assert.ok(unik, "KomponenNilai kehilangan @@unique-nya");
    assert.ok(!unik[1].includes("namaEn"), `namaEn masuk kunci: ${unik[1]}`);
  });
});

describe("ruang sidik kedua", () => {
  it("bekukanRpkps tidak menyentuh sidik ruang pertama", () => {
    // Penjaga tekstual: `sidik` HARUS berasal dari `sidikRpkps`, dan `sidikEn`
    // dari `sidikRpkpsEn`. Menukar keduanya — atau menghitung `sidik` dari
    // proyeksi Inggris — akan menulis ulang sidik setiap dokumen yang
    // diterbitkan sesudahnya, dan tidak ada uji nilai yang menangkapnya
    // karena kedua fungsi sama-sama mengembalikan string 64 heksadesimal.
    const isi = readFileSync("src/lib/rpkps/snapshot.ts", "utf8");
    assert.match(isi, /const sidik = sidikRpkps\(rpkps\);/);
    assert.match(isi, /sidikEn = adaTerjemahan \? sidikRpkpsEn\(rpkps\) : null/);
  });

  it("proyeksi Indonesia tidak mengimpor apa pun dari proyeksi Inggris", () => {
    // Satu arah saja: `proyeksi-en.ts` boleh tahu tentang `proyeksi.ts`,
    // tidak sebaliknya. Impor balik adalah langkah pertama menuju medan
    // Inggris yang diam-diam ikut ke ruang sidik pertama.
    const isi = readFileSync("src/domain/rpkps/proyeksi.ts", "utf8");
    assert.ok(!isi.includes("proyeksi-en"), "proyeksi.ts mengimpor proyeksi-en");
    assert.ok(!/\bEn\b|En:/.test(isi.replace(/\/\*[\s\S]*?\*\//g, "")), "proyeksi.ts menyebut medan En");
  });
});
