import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { babBergeser, sidikSumberBab } from "./sidik-sumber";

const rencana = {
  topik: "Pohon biner",
  subtopik: ["Penelusuran", "Penyisipan"],
  indikator: ["Mahasiswa mampu menelusuri pohon biner"],
  subCpmk: [{ kode: "SUB-CPMK2" }, { kode: "SUB-CPMK1" }],
};

describe("sidik rencana minggu", () => {
  it("stabil untuk isi yang sama", () => {
    assert.equal(sidikSumberBab(rencana), sidikSumberBab({ ...rencana }));
  });

  it("berubah bila topik, subtopik, indikator, atau Sub-CPMK berubah", () => {
    const asal = sidikSumberBab(rencana);
    assert.notEqual(asal, sidikSumberBab({ ...rencana, topik: "Pohon AVL" }));
    assert.notEqual(asal, sidikSumberBab({ ...rencana, subtopik: ["Penelusuran"] }));
    assert.notEqual(asal, sidikSumberBab({ ...rencana, indikator: ["Lain"] }));
    assert.notEqual(
      asal,
      sidikSumberBab({ ...rencana, subCpmk: [{ kode: "SUB-CPMK9" }] }),
    );
  });

  it("urutan Sub-CPMK bukan perubahan rencana", () => {
    // Urutan Sub-CPMK pada sebuah minggu tidak dibaca model, jadi menukarnya
    // tidak boleh menandai seluruh bab bergeser.
    assert.equal(
      sidikSumberBab(rencana),
      sidikSumberBab({
        ...rencana,
        subCpmk: [{ kode: "SUB-CPMK1" }, { kode: "SUB-CPMK2" }],
      }),
    );
  });

  it("spasi berlebih bukan perubahan rencana", () => {
    assert.equal(
      sidikSumberBab(rencana),
      sidikSumberBab({
        ...rencana,
        topik: "  Pohon   biner ",
        subtopik: ["Penelusuran ", " Penyisipan"],
      }),
    );
  });

  it("topik kosong dan topik null sama saja", () => {
    const a = sidikSumberBab({ ...rencana, topik: null });
    const b = sidikSumberBab({ ...rencana, topik: "   " });
    assert.equal(a, b);
  });
});

describe("penanda bab bergeser", () => {
  it("menyala hanya bila kedua sidik diketahui dan berbeda", () => {
    assert.equal(babBergeser("a", "b"), true);
    assert.equal(babBergeser("a", "a"), false);
    // Bab lama tanpa sidik, atau minggu yang sudah tidak ada: tidak ada yang
    // dapat dibandingkan, jadi tidak ada yang boleh diklaim.
    assert.equal(babBergeser(null, "b"), false);
    assert.equal(babBergeser("a", null), false);
  });
});
