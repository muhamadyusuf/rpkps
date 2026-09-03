import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isbnSah, rapikanIsbn } from "./isbn";

describe("pemeriksaan ISBN", () => {
  it("menerima ISBN-13 yang sah, dengan atau tanpa tanda hubung", () => {
    assert.equal(isbnSah("978-3-16-148410-0"), true);
    assert.equal(isbnSah("9783161484100"), true);
    assert.equal(isbnSah("978 602 8519 43 4"), true);
  });

  it("menolak ISBN-13 yang satu digitnya salah ketik", () => {
    // Inilah gunanya memeriksa lebih dari sekadar "13 angka".
    assert.equal(isbnSah("978-3-16-148410-1"), false);
    assert.equal(isbnSah("9783161484200"), false);
  });

  it("menolak awalan yang bukan alokasi buku", () => {
    assert.equal(isbnSah("1234567890128"), false);
  });

  it("menerima ISBN-10, termasuk digit periksa X", () => {
    assert.equal(isbnSah("0-306-40615-2"), true);
    assert.equal(isbnSah("155860832X"), true);
    assert.equal(isbnSah("1558608321"), false);
  });

  it("menolak panjang yang bukan 10 atau 13", () => {
    assert.equal(isbnSah("978316148410"), false);
    assert.equal(isbnSah("97831614841000"), false);
  });

  it("kosong bukan ISBN", () => {
    assert.equal(isbnSah(null), false);
    assert.equal(isbnSah(""), false);
    assert.equal(isbnSah("   "), false);
  });

  it("merapikan tanda hubung tipografis, bukan hanya tanda hubung biasa", () => {
    assert.equal(rapikanIsbn("978‐3‑16–148410—0"), "9783161484100");
  });
});
