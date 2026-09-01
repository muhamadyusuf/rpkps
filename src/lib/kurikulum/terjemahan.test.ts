import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga kolom `*En` pada LAPISAN KURIKULUM (docs/11 §5.1b).
 *
 * Bentuknya sama dengan `src/lib/rpkps/terjemahan.test.ts`, tetapi kegagalan
 * yang dijaganya berbeda. Di lapisan RPKPS, kolom yang tertinggal dari muatan
 * simpan akan TERHAPUS saat baris ditulis ulang. Di sini bahayanya lebih
 * senyap: aksi kurikulum menyimpan `parsed.data` sebuah skema Zod, jadi kolom
 * yang tidak ada di skema itu tidak pernah dapat diisi oleh siapa pun. Ia
 * tetap ada di basis data, tetap kosong selamanya, dan tidak ada satu pun
 * galat yang muncul — persis nasib `MataKuliah.namaEn` selama empat bulan
 * pertamanya.
 *
 * Kolom `*En` yang memang belum punya penyunting sengaja TIDAK didaftarkan di
 * sini: menuntut penulis untuk kolom yang belum dirancang penyuntingnya
 * membuat penjaga gagal tanpa ada yang dapat memperbaikinya (docs/11 §5.1a).
 */

const SKEMA = readFileSync("prisma/schema.prisma", "utf8");

function kolomEn(model: string): string[] {
  const m = SKEMA.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${model} tidak ditemukan di schema.prisma`);
  return [...m[1].matchAll(/^\s+(\w+En)\s/gm)].map((x) => x[1]);
}

const PENULIS: { model: string; berkas: string }[] = [
  { model: "MataKuliah", berkas: "src/app/[bahasa]/(app)/kurikulum/aksi-mk.ts" },
  { model: "Cpl", berkas: "src/app/[bahasa]/(app)/kurikulum/aksi-cpl.ts" },
  { model: "Cpmk", berkas: "src/app/[bahasa]/(app)/kurikulum/aksi-cpmk.ts" },
  { model: "SubCpmk", berkas: "src/app/[bahasa]/(app)/kurikulum/aksi-cpmk.ts" },
];

describe("medan Inggris lapisan kurikulum punya penyuntingnya", () => {
  for (const { model, berkas } of PENULIS) {
    it(`${model} — seluruh kolom *En disebut di ${berkas.split("/").pop()}`, () => {
      const kolom = kolomEn(model);
      assert.ok(kolom.length > 0, `${model} tidak punya kolom *En — daftar penjaga basi?`);
      const isi = readFileSync(berkas, "utf8");
      for (const nama of kolom) {
        assert.ok(
          isi.includes(nama),
          `${berkas} tidak menyebut ${model}.${nama} — kolomnya ada di basis ` +
            `data tetapi tak seorang pun dapat mengisinya`,
        );
      }
    });
  }
});

describe("identitas mata kuliah", () => {
  it("namaEn tidak menjadi bagian kunci unik", () => {
    // Alasannya sama dengan `komponen_nilai.nama_en`: kalau terjemahan ikut
    // menentukan identitas baris, mengubahnya akan melepas rujukan yang
    // menggantung padanya — di sini RPKPS, kelas, dan nilai.
    const m = SKEMA.match(/^model MataKuliah \{([\s\S]*?)^\}/m);
    assert.ok(m);
    const unik = m[1].match(/@@unique\(\[([^\]]+)\]\)/);
    assert.ok(unik, "MataKuliah kehilangan @@unique-nya");
    assert.ok(!unik[1].includes("namaEn"), `namaEn masuk kunci: ${unik[1]}`);
  });
});
