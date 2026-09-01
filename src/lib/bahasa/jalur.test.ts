import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bahasaPadaJalur,
  jalur,
  lepasAwalan,
  segalaBahasa,
  tanpaAwalanBahasa,
} from "./jalur";

describe("jalur berawalan bahasa", () => {
  it("memasang awalan pada alamat internal", () => {
    assert.equal(jalur("/rpkps", "id"), "/id/rpkps");
    assert.equal(jalur("/rpkps/abc", "en"), "/en/rpkps/abc");
  });

  it("akar menjadi alamat bahasa itu sendiri, bukan '/id/'", () => {
    assert.equal(jalur("/", "id"), "/id");
    assert.equal(jalur("/", "en"), "/en");
  });

  it("tidak berlapis bila sudah berawalan", () => {
    // Penjaga terpenting di berkas ini: Tautan dipakai di komponen yang
    // kadang menerima href dari pemanggil yang sudah memasang awalan.
    assert.equal(jalur("/en/rpkps", "en"), "/en/rpkps");
    assert.equal(jalur("/id/rpkps", "en"), "/id/rpkps");
  });

  it("membiarkan alamat luar apa adanya", () => {
    assert.equal(jalur("https://itts.ac.id", "en"), "https://itts.ac.id");
    assert.equal(jalur("mailto:mutu@itts.ac.id", "en"), "mailto:mutu@itts.ac.id");
    assert.equal(jalur("#ringkasan", "en"), "#ringkasan");
  });

  it("membiarkan API dan berkas akar tanpa awalan", () => {
    assert.equal(jalur("/api/rpkps/abc/docx", "en"), "/api/rpkps/abc/docx");
    assert.equal(jalur("/sitemap.xml", "en"), "/sitemap.xml");
    assert.ok(tanpaAwalanBahasa("/api"));
    assert.ok(!tanpaAwalanBahasa("/apikasi")); // bukan awalan ruas
  });

  it("membaca dan melepas awalan", () => {
    assert.equal(bahasaPadaJalur("/en/katalog/TI"), "en");
    assert.equal(bahasaPadaJalur("/katalog/TI"), null);
    assert.equal(bahasaPadaJalur("/eng/katalog"), null);
    assert.equal(lepasAwalan("/en/katalog/TI"), "/katalog/TI");
    assert.equal(lepasAwalan("/en"), "/");
    assert.equal(lepasAwalan("/katalog"), "/katalog");
  });

  it("segalaBahasa menghasilkan satu alamat per bahasa", () => {
    assert.deepEqual(segalaBahasa("/rpkps"), ["/id/rpkps", "/en/rpkps"]);
  });
});
