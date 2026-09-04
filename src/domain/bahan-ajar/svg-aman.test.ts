import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { periksaSvgAman } from "./svg-aman";

/**
 * Uji sanitasi SVG — docs/17 §5.1.
 *
 * Berkas ini adalah penjaga keamanan, bukan penjaga rupa. Tiap kasus di bawah
 * adalah muatan yang sungguh dipakai orang untuk menyelundupkan skrip ke dalam
 * halaman lewat berkas yang tampak seperti gambar.
 */

const SAH = `<svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <title>Alur penelusuran</title>
  <rect x="10" y="10" width="200" height="80" fill="#F3F4F6" stroke="#111827" stroke-width="1.5"/>
  <text x="20" y="55" font-family="Times New Roman, serif" font-size="14" fill="#111827">Mulai</text>
  <path d="M210 50 L320 50" stroke="#111827" stroke-width="1.5" marker-end="url(#panah)"/>
</svg>`;

function kode(svg: string): string[] {
  return periksaSvgAman(svg).temuan.map((t) => t.kode);
}

describe("sanitasi SVG — yang sah", () => {
  it("SVG diagram biasa lolos dan dikembalikan apa adanya", () => {
    const hasil = periksaSvgAman(SAH);
    assert.deepEqual(hasil.temuan, []);
    assert.equal(hasil.ok, true);
    // Apa adanya, bukan ditulis ulang: tidak boleh ada celah antara yang
    // diperiksa dan yang disimpan.
    assert.equal(hasil.svg, SAH.trim());
  });

  it("komentar, deklarasi XML, dan tag tunggal diterima", () => {
    const hasil = periksaSvgAman(
      `<?xml version="1.0" encoding="UTF-8"?>
       <svg viewBox="0 0 10 10"><!-- catatan --><circle cx="5" cy="5" r="4" fill="none"/></svg>`,
    );
    assert.deepEqual(hasil.temuan, []);
  });

  it("rujukan ke fragmen dalam berkas yang sama diterima", () => {
    const hasil = periksaSvgAman(
      `<svg viewBox="0 0 10 10"><defs><marker id="p"><path d="M0 0"/></marker></defs>` +
        `<use href="#p"/><use xlink:href="#p"/></svg>`,
    );
    assert.deepEqual(hasil.temuan, []);
  });
});

describe("sanitasi SVG — yang ditolak", () => {
  it("script ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>`).includes(
        "IL-SVG-ELEMEN-TERLARANG",
      ),
    );
  });

  it("penangan peristiwa ditolak, dalam bentuk apa pun", () => {
    for (const muatan of [
      `<svg viewBox="0 0 1 1" onload="alert(1)"></svg>`,
      `<svg viewBox="0 0 1 1"><rect ONMOUSEOVER="alert(1)"/></svg>`,
      `<svg viewBox="0 0 1 1"><circle onfocusin='alert(1)'/></svg>`,
    ]) {
      assert.ok(kode(muatan).includes("IL-SVG-ATRIBUT-TERLARANG"), muatan);
    }
  });

  it("foreignObject ditolak", () => {
    // Selain jalur masuk HTML, ia juga TIDAK dirender di dalam <img> — jadi
    // menerimanya berarti mencetak diagram berlabel kosong.
    assert.ok(
      kode(
        `<svg viewBox="0 0 10 10"><foreignObject><div>halo</div></foreignObject></svg>`,
      ).includes("IL-SVG-ELEMEN-TERLARANG"),
    );
  });

  it("image, filter, dan style ditolak sebagai elemen", () => {
    for (const elemen of ["image", "filter", "style", "animate", "iframe", "set"]) {
      assert.ok(
        kode(`<svg viewBox="0 0 1 1"><${elemen} /></svg>`).includes(
          "IL-SVG-ELEMEN-TERLARANG",
        ),
        elemen,
      );
    }
  });

  it("atribut style ditolak", () => {
    // Bukan sekadar soal rupa: `style` menerima `url(...)` dan mengembalikan
    // pengambilan sumber daya luar lewat pintu belakang.
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><rect style="fill:url(http://x/y)"/></svg>`).includes(
        "IL-SVG-ATRIBUT-TERLARANG",
      ),
    );
  });

  it("rujukan ke alamat luar ditolak", () => {
    for (const muatan of [
      `<svg viewBox="0 0 1 1"><use href="https://jahat.example/x.svg#a"/></svg>`,
      `<svg viewBox="0 0 1 1"><use xlink:href="//jahat.example/x"/></svg>`,
      `<svg viewBox="0 0 1 1"><use href="javascript:alert(1)"/></svg>`,
      `<svg viewBox="0 0 1 1"><use href="data:image/svg+xml;base64,PHN2Zz4="/></svg>`,
    ]) {
      assert.ok(kode(muatan).includes("IL-SVG-RUJUKAN-LUAR"), muatan);
    }
  });

  it("DOCTYPE dan deklarasi entitas ditolak sebelum apa pun diurai", () => {
    // Billion laughs: entitas yang memuat dirinya berlipat ganda sampai
    // memori habis. Ditolak di awal, bukan setelah diurai.
    const bom =
      `<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;">]>` +
      `<svg viewBox="0 0 1 1"><text>&b;</text></svg>`;
    assert.deepEqual(kode(bom), ["IL-SVG-DOCTYPE"]);
  });

  it("entitas eksternal yang membaca berkas server ditolak", () => {
    const xxe =
      `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>` +
      `<svg viewBox="0 0 1 1"><text>&x;</text></svg>`;
    assert.deepEqual(kode(xxe), ["IL-SVG-DOCTYPE"]);
  });

  it("CDATA ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><text><![CDATA[<script>alert(1)</script>]]></text></svg>`)
        .includes("IL-SVG-DOCTYPE"),
    );
  });

  it("entitas karangan di luar daftar XML ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><text>&jahat;</text></svg>`).includes("IL-SVG-ENTITAS"),
    );
    // Entitas XML yang sah tetap diterima.
    assert.deepEqual(kode(`<svg viewBox="0 0 1 1"><text>a &amp; b &#65;</text></svg>`), []);
  });

  it("instruksi pemrosesan di luar deklarasi awal ditolak", () => {
    assert.ok(
      kode(`<svg viewBox="0 0 1 1"><?xml-stylesheet href="x.css"?></svg>`).includes(
        "IL-SVG-INSTRUKSI",
      ),
    );
  });

  it("tanda lebih-besar di dalam nilai atribut tidak mengelabui pengurai", () => {
    /*
     * Inilah celah yang membuat pemindai berbasis regex `/<[^>]*>/` dapat
     * ditembus: satu `>` di dalam tanda kutip membuat sisa dokumen terbaca
     * sebagai teks biasa, sehingga elemen berbahaya sesudahnya tidak pernah
     * diperiksa. Pengurai kita membaca tanda kutip lebih dulu.
     */
    const muatan =
      `<svg viewBox="0 0 1 1"><rect fill="a>b"/><script>alert(1)</script></svg>`;
    assert.ok(kode(muatan).includes("IL-SVG-ELEMEN-TERLARANG"), "script terlewat");
  });

  it("nilai atribut tanpa tanda kutip ditolak", () => {
    // Batas atribut yang bergantung pada spasi adalah sumber ketidaksepakatan
    // antara pengurai kita dan pengurai peramban.
    assert.deepEqual(kode(`<svg viewBox=0 0 1 1><rect/></svg>`), ["IL-SVG-RUSAK"]);
  });

  it("tag yang tidak tertutup ditolak", () => {
    assert.ok(kode(`<svg viewBox="0 0 1 1"><g><rect/></svg>`).includes("IL-SVG-RUSAK"));
    assert.ok(kode(`<svg viewBox="0 0 1 1"><rect`).includes("IL-SVG-RUSAK"));
  });

  it("akar yang bukan svg ditolak", () => {
    assert.ok(kode(`<html><body>halo</body></html>`).includes("IL-SVG-BUKAN-SVG"));
  });

  it("svg tanpa viewBox ditolak", () => {
    assert.deepEqual(kode(`<svg width="10" height="10"><rect/></svg>`), [
      "IL-SVG-TANPA-VIEWBOX",
    ]);
  });

  it("berkas kosong dan berkas raksasa ditolak", () => {
    assert.deepEqual(kode("   "), ["IL-SVG-TERLALU-BESAR"]);
    assert.deepEqual(kode("<svg>".padEnd(200_001, " ")), ["IL-SVG-TERLALU-BESAR"]);
  });

  it("diagram dengan elemen tak terhingga ditolak", () => {
    const banyak = `<svg viewBox="0 0 1 1">${"<rect/>".repeat(3_100)}</svg>`;
    assert.deepEqual(kode(banyak), ["IL-SVG-TERLALU-RUMIT"]);
  });

  it("yang ditolak tidak pernah mengembalikan svg", () => {
    const hasil = periksaSvgAman(`<svg viewBox="0 0 1 1"><script/></svg>`);
    assert.equal(hasil.ok, false);
    assert.equal(hasil.svg, null);
  });

  it("setiap penolakan punya kalimatnya, dengan penanda terisi", () => {
    const semua = [
      `<svg viewBox="0 0 1 1"><script/></svg>`,
      `<svg viewBox="0 0 1 1" onload="x"></svg>`,
      `<svg viewBox="0 0 1 1"><use href="https://x/y"/></svg>`,
      `<!DOCTYPE svg><svg viewBox="0 0 1 1"/>`,
      `<svg viewBox="0 0 1 1"><text>&x;</text></svg>`,
      `<svg width="1"><rect/></svg>`,
      `<html/>`,
      "   ",
      `<svg viewBox="0 0 1 1">${"<rect/>".repeat(3_100)}</svg>`,
      `<svg viewBox="0 0 1 1"><?x?></svg>`,
      `<svg viewBox="0 0 1 1"><g></svg>`,
    ];
    for (const muatan of semua) {
      for (const t of periksaSvgAman(muatan).temuan) {
        const pesan = pesanTemuanId(t);
        // Yang dicari adalah penanda yang belum terisi (`{daftar}`), bukan
        // setiap kurung kurawal: kalimatnya mengutip kode yang ditolak, dan
        // kode itu sendiri boleh memuat kurawal.
        assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${t.kode}: ${pesan}`);
        assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
      }
    }
  });
});
