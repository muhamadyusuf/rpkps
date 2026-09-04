import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { periksaGayaSvg } from "./gaya-svg";
import { periksaSvgAman } from "./svg-aman";

/**
 * Uji cetakan gaya diagram — docs/17 §4.3.
 *
 * Ini penjaga RUPA, bukan keamanan. Tiap aturan di sini menolak satu ciri yang
 * membuat gambar terbaca sebagai keluaran mesin.
 */

const SAH = `<svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="200" height="80" fill="#F3F4F6" stroke="#111827" stroke-width="1.5"/>
  <line x1="210" y1="50" x2="320" y2="50" stroke="#6B7280" stroke-width="1.5"/>
  <text x="20" y="55" font-family="Times New Roman, Liberation Serif, serif" font-size="14" fill="#111827">Mulai</text>
</svg>`;

function kode(svg: string): string[] {
  return periksaGayaSvg(svg).temuan.map((t) => t.kode);
}

describe("cetakan gaya diagram", () => {
  it("diagram yang mengikuti cetakan tidak memunculkan satu temuan pun", () => {
    assert.deepEqual(periksaGayaSvg(SAH).temuan, []);
    assert.equal(periksaGayaSvg(SAH).ok, true);
  });

  it("gradien ditolak — dalam bentuk elemen maupun rujukan", () => {
    assert.ok(
      kode(
        `<svg viewBox="0 0 1 1"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs></svg>`,
      ).includes("IL-GAYA-GRADIEN"),
    );
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><rect fill="url(#g)"/></svg>`).includes("IL-GAYA-GRADIEN"),
    );
  });

  it("gradien lolos sanitasi tetapi ditolak gaya — dan itu disengaja", () => {
    /*
     * Dua modul, dua pesan. Gradien bukan lubang keamanan, jadi menolaknya
     * sebagai "elemen berbahaya" akan berbohong kepada penulisnya tentang apa
     * yang salah dan apa yang harus diperbaiki.
     */
    const svg = `<svg viewBox="0 0 1 1"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs></svg>`;
    assert.equal(periksaSvgAman(svg).ok, true);
    assert.equal(periksaGayaSvg(svg).ok, false);
  });

  it("transparansi ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><rect opacity="0.4"/></svg>`).includes("IL-GAYA-TEMBUS"),
    );
    // Buram penuh bukan transparansi.
    assert.ok(!kode(`<svg viewBox="0 0 1 1"><rect opacity="1"/></svg>`).includes("IL-GAYA-TEMBUS"));
  });

  it("warna di luar palet ditolak, beserta daftarnya", () => {
    const hasil = periksaGayaSvg(
      `<svg viewBox="0 0 1 1"><rect fill="#FF00AA" stroke="teal"/></svg>`,
    );
    const t = hasil.temuan.find((x) => x.kode === "IL-GAYA-WARNA-ASING");
    assert.equal(t?.params?.jumlah, 2);
    assert.match(String(t?.params?.daftar), /#FF00AA/);
  });

  it("palet buku dan none/putih diterima", () => {
    assert.deepEqual(
      kode(
        `<svg viewBox="0 0 1 1"><rect fill="none" stroke="#1D4ED8" stroke-width="2.5"/>` +
          `<rect fill="#ffffff" stroke="#6b7280" stroke-width="1.5"/></svg>`,
      ),
      [],
    );
  });

  it("ketebalan garis di luar 1.5 dan 2.5 ditolak", () => {
    const hasil = periksaGayaSvg(
      `<svg viewBox="0 0 1 1"><rect stroke-width="3"/><line stroke-width="0.75"/></svg>`,
    );
    const t = hasil.temuan.find((x) => x.kode === "IL-GAYA-GARIS");
    assert.match(String(t?.params?.daftar), /0\.75/);
    assert.match(String(t?.params?.daftar), /3/);
  });

  it("label lebih kecil dari 12 ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><text font-size="9">kecil</text></svg>`).includes(
        "IL-GAYA-TEKS-KECIL",
      ),
    );
    assert.ok(
      !kode(`<svg viewBox="0 0 1 1"><text font-size="12">pas</text></svg>`).includes(
        "IL-GAYA-TEKS-KECIL",
      ),
    );
  });

  it("font tanpa keluarga generik di ujung ditolak", () => {
    // Gambar dirender di dalam <img>, tempat webfont halaman tidak ikut.
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><text font-family="Inter">a</text></svg>`).includes(
        "IL-GAYA-FONT-ASING",
      ),
    );
    assert.deepEqual(
      kode(`<svg viewBox="0 0 1 1"><text font-family="Georgia, serif">a</text></svg>`),
      [],
    );
  });

  it("ukuran tetap pada tag svg ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1" width="800" height="400"></svg>`).includes(
        "IL-GAYA-UKURAN-TETAP",
      ),
    );
    // width pada bentuk di dalamnya sama sekali bukan urusan aturan ini.
    assert.ok(
      !kode(`<svg viewBox="0 0 1 1"><rect width="10" height="10" fill="none"/></svg>`).includes(
        "IL-GAYA-UKURAN-TETAP",
      ),
    );
  });

  it("setiap temuan gaya punya kalimatnya, dengan penanda terisi", () => {
    const hasil = periksaGayaSvg(
      `<svg viewBox="0 0 1 1" width="8"><defs><linearGradient id="g"/></defs>` +
        `<rect fill="#FF00AA" stroke-width="3" opacity="0.5"/>` +
        `<text font-size="8" font-family="Inter">a</text></svg>`,
    );
    assert.ok(hasil.temuan.length >= 7);
    for (const t of hasil.temuan) {
      const pesan = pesanTemuanId(t);
      assert.ok(!pesan.includes("{"), `${t.kode}: ${pesan}`);
      assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
    }
  });
});
