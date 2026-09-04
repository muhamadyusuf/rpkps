import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import {
  BATAS_SISI,
  bacaDataUriPng,
  kenaliJenis,
  periksaBerkasGambar,
} from "./berkas-gambar";

/** PNG terkecil yang sah, dengan lebar dan tinggi yang dapat diatur. */
function png(lebar = 4, tinggi = 3): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8); // panjang IHDR
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const tulis = (n: number, i: number) =>
    b.set([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], i);
  tulis(lebar, 16);
  tulis(tinggi, 20);
  return b;
}

/** JPEG dengan satu penanda DQT sebelum SOF0, seperti berkas sungguhan. */
function jpeg(lebar = 800, tinggi = 600): Uint8Array {
  const b: number[] = [0xff, 0xd8];
  b.push(0xff, 0xdb, 0x00, 0x04, 0x00, 0x00); // DQT sepanjang 4
  b.push(0xff, 0xc0, 0x00, 0x11, 0x08);
  b.push((tinggi >> 8) & 255, tinggi & 255, (lebar >> 8) & 255, lebar & 255);
  b.push(0, 0, 0, 0, 0, 0, 0, 0);
  return new Uint8Array(b);
}

describe("pemeriksaan berkas gambar", () => {
  it("PNG dan JPEG dikenali beserta ukurannya", () => {
    const a = periksaBerkasGambar(png(120, 80));
    assert.equal(a.ok, true);
    assert.deepEqual([a.jenis, a.lebar, a.tinggi], ["PNG", 120, 80]);

    const c = periksaBerkasGambar(jpeg(1024, 768));
    assert.equal(c.ok, true);
    assert.deepEqual([c.jenis, c.lebar, c.tinggi], ["JPEG", 1024, 768]);
  });

  it("YANG DIPERIKSA ADALAH ISI BERKAS, BUKAN NAMANYA", () => {
    /*
     * Berkas bernama `.png` yang isinya HTML adalah cara tertua menyelundupkan
     * halaman ke dalam sebuah situs — dan `Content-Type` datang dari pengirim
     * yang sama, jadi ia tidak dapat dipakai sebagai bukti apa pun.
     */
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const hasil = periksaBerkasGambar(html);
    assert.equal(hasil.ok, false);
    assert.deepEqual(hasil.temuan.map((t) => t.kode), ["IL-BERKAS-BUKAN-GAMBAR"]);
    assert.equal(kenaliJenis(html), null);
  });

  it("SVG bukan berkas raster, dan ditolak jalur ini", () => {
    // SVG punya jalurnya sendiri (`svg-aman.ts`); ia tidak boleh menyelinap
    // masuk sebagai "gambar" tanpa sanitasi.
    const svg = new TextEncoder().encode('<svg viewBox="0 0 1 1"/>');
    assert.equal(periksaBerkasGambar(svg).ok, false);
  });

  it("berkas kosong dan berkas raksasa ditolak", () => {
    assert.equal(periksaBerkasGambar(new Uint8Array(0)).ok, false);
    const raksasa = new Uint8Array(3 * 1024 * 1024);
    raksasa.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    assert.deepEqual(
      periksaBerkasGambar(raksasa).temuan.map((t) => t.kode),
      ["IL-BERKAS-TERLALU-BESAR"],
    );
  });

  it("gambar melebihi batas sisi ditolak", () => {
    assert.deepEqual(
      periksaBerkasGambar(png(BATAS_SISI + 1, 100)).temuan.map((t) => t.kode),
      ["IL-BERKAS-TERLALU-LEBAR"],
    );
    assert.equal(periksaBerkasGambar(png(BATAS_SISI, BATAS_SISI)).ok, true);
  });

  it("PNG tanpa IHDR yang sah ditolak", () => {
    const rusak = png();
    rusak.set([0x58, 0x58, 0x58, 0x58], 12); // bukan "IHDR"
    assert.deepEqual(periksaBerkasGambar(rusak).temuan.map((t) => t.kode), ["IL-BERKAS-RUSAK"]);
  });

  it("PNG berukuran nol ditolak", () => {
    assert.equal(periksaBerkasGambar(png(0, 0)).ok, false);
  });
});

describe("membaca data URI", () => {
  it("hanya menerima PNG", () => {
    const uri = `data:image/png;base64,${Buffer.from(png()).toString("base64")}`;
    const bita = bacaDataUriPng(uri);
    assert.ok(bita);
    assert.equal(kenaliJenis(bita), "PNG");

    // Jenis lain ditolak: peramban kita selalu menghasilkan PNG, jadi apa pun
    // selain itu datang dari pengirim lain.
    assert.equal(bacaDataUriPng("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), null);
    assert.equal(bacaDataUriPng("data:text/html;base64,PGgxPmE8L2gxPg=="), null);
    assert.equal(bacaDataUriPng("bukan data uri"), null);
  });

  it("base64 yang tidak sah ditolak, tidak melempar", () => {
    assert.equal(bacaDataUriPng("data:image/png;base64,!!!bukan-base64!!!"), null);
    assert.equal(bacaDataUriPng("data:image/png;base64,"), null);
  });

  it("awalan yang mirip tidak lolos", () => {
    // "data:image/png;base64" tanpa koma, dan awalan yang disamarkan.
    assert.equal(bacaDataUriPng("data:image/png;base64"), null);
    assert.equal(bacaDataUriPng(" data:image/png;base64,AAAA"), null);
  });

  it("setiap penolakan punya kalimatnya", () => {
    const semua = [
      new Uint8Array(0),
      new TextEncoder().encode("<html>"),
      png(BATAS_SISI + 1, 1),
    ];
    for (const bita of semua) {
      for (const t of periksaBerkasGambar(bita).temuan) {
        const pesan = pesanTemuanId(t);
        assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${t.kode}: ${pesan}`);
        assert.notEqual(pesan, t.kode);
      }
    }
  });
});
