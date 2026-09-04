import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Penjaga lapis kedua — docs/17 I2 dan §5.2.
 *
 * Sanitasi di server adalah lapis pertama. Lapis keduanya berupa aturan yang
 * tidak dapat diberi tipe: **SVG hanya dirender di dalam `<img>`**. Di sana
 * skrip tidak dieksekusi dan rujukan luar tidak diambil, apa pun yang lolos
 * dari lapis pertama.
 *
 * Aturan itu dilanggar dengan satu baris — `dangerouslySetInnerHTML`, atau
 * sebuah `<svg>` yang dirakit dari string — dan pelanggarannya tidak
 * memunculkan galat apa pun. Yang terjadi hanyalah halaman yang menjalankan
 * skrip milik orang lain. Karena itu penjaganya memindai sumber.
 */

/**
 * Isi berkas TANPA komentar.
 *
 * Berkas-berkas ini menjelaskan panjang lebar mengapa `innerHTML` tidak boleh
 * dipakai, dan penjelasan itu harus tetap boleh menyebut kata yang
 * dilarangnya. Yang dicari adalah KODENYA.
 */
function kode(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

function berkasDi(akar: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(akar)) {
    const jalur = join(akar, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasDi(jalur));
    else if (/\.(ts|tsx)$/.test(nama) && !nama.endsWith(".test.ts")) hasil.push(jalur);
  }
  return hasil;
}

/** Berkas yang benar-benar mengurus gambar buku ajar. */
const BERKAS = [
  ...berkasDi("src/app/[bahasa]/(app)/bahan-ajar"),
  ...berkasDi("src/lib/bahan-ajar"),
  ...berkasDi("src/domain/bahan-ajar"),
];

describe("gambar hanya dirender di dalam <img>", () => {
  it("ada berkas yang dipindai", () => {
    // Pemindai yang tidak menemukan apa pun lolos tanpa memeriksa apa pun.
    assert.ok(BERKAS.length >= 10, `hanya ${BERKAS.length} berkas terbaca`);
    assert.ok(
      BERKAS.some((b) => b.includes("panel-gambar")),
      "berkas panel gambar tidak ikut terpindai",
    );
  });

  it("tidak ada dangerouslySetInnerHTML maupun innerHTML", () => {
    for (const berkas of BERKAS) {
      const isi = kode(berkas);
      assert.ok(
        !isi.includes("dangerouslySetInnerHTML"),
        `${berkas} memakai dangerouslySetInnerHTML`,
      );
      assert.ok(!/\.innerHTML\s*=/.test(isi), `${berkas} menulis ke innerHTML`);
      assert.ok(
        !/insertAdjacentHTML|document\.write/.test(isi),
        `${berkas} menyisipkan markah mentah`,
      );
    }
  });

  it("tidak ada elemen <svg> yang dirakit dari isi gambar", () => {
    /*
     * Yang dilarang adalah menyisipkan SVG milik model ke dalam pohon dokumen.
     * `<svg>` bertulis tangan di dalam JSX — ikon, bagan yang kita gambar
     * sendiri — bukan bagian larangan ini; yang dicari adalah perakitan dari
     * string.
     */
    for (const berkas of BERKAS) {
      const isi = kode(berkas);
      assert.ok(
        !/createElement\(\s*["']svg["']/.test(isi),
        `${berkas} merakit elemen svg sendiri`,
      );
    }
  });

  it("pratinjau memakai data URI lewat komponen img", () => {
    const panel = kode(
      "src/app/[bahasa]/(app)/bahan-ajar/[id]/bab/[nomor]/panel-gambar.tsx",
    );
    assert.match(panel, /<img/, "pratinjau tidak memakai <img>");
    assert.match(panel, /svgKeDataUri\(/, "SVG tidak dipasang sebagai data URI");
  });

  it("rasterisasi tidak pernah menyentuh pohon dokumen dengan SVG", () => {
    const raster = kode("src/lib/bahan-ajar/rasterkan.ts");
    // Kanvas dan Image dibuat, SVG-nya hanya menjadi `src`.
    assert.match(raster, /new Image\(\)/);
    assert.match(raster, /createElement\("canvas"\)/);
    assert.ok(!raster.includes("innerHTML"));
  });

  it("Mermaid dirender dengan htmlLabels dimatikan", () => {
    /*
     * Bukan sekadar keamanan: label `foreignObject` TIDAK dirender di dalam
     * `<img>`, jadi menyalakannya menghasilkan diagram yang tercetak berisi
     * kotak kosong — tanpa satu pesan galat pun.
     */
    const raster = kode("src/lib/bahan-ajar/rasterkan.ts");
    assert.match(raster, /htmlLabels:\s*false/);
    assert.match(raster, /securityLevel:\s*"strict"/);
  });

  it("Mermaid diimpor dinamis, bukan di puncak berkas", () => {
    // Pustakanya besar; hanya halaman bab yang memerlukannya.
    const raster = kode("src/lib/bahan-ajar/rasterkan.ts");
    assert.match(raster, /await import\("mermaid"\)/);
    assert.ok(!/^import .*from "mermaid"/m.test(raster));
  });

  it("aksi gambar memeriksa ulang kiriman peramban", () => {
    // Peramban memang milik dosen, tetapi yang tiba di server tetap kiriman
    // klien biasa — dan yang menulis ke basis data adalah server.
    const aksi = kode("src/app/[bahasa]/(app)/bahan-ajar/[id]/aksi-gambar.ts");
    for (const penjaga of [
      "periksaSvgAman(",
      "periksaGayaSvg(",
      "periksaMermaid(",
      "periksaBerkasGambar(",
      "bacaDataUriPng(",
    ]) {
      assert.ok(aksi.includes(penjaga), `aksi gambar tidak memanggil ${penjaga}`);
    }
  });
});
