import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungKelengkapan } from "./terjemahan";

describe("kelengkapan terjemahan", () => {
  it("hanya menghitung medan yang ada isinya", () => {
    // Topik kosong bukan pekerjaan terjemahan yang tertinggal — ia memang
    // tidak ada, dan memasukkannya ke penyebut membuat angkanya berbohong.
    const h = hitungKelengkapan([
      { asal: "Basis data", terjemahan: "Databases" },
      { asal: "", terjemahan: "" },
      { asal: null, terjemahan: null },
    ]);
    assert.deepEqual(h, { terisi: 1, total: 1, persen: 100, sebagian: false });
  });

  it("spasi kosong dihitung belum diterjemahkan", () => {
    const h = hitungKelengkapan([{ asal: "Basis data", terjemahan: "   " }]);
    assert.equal(h.terisi, 0);
    assert.equal(h.persen, 0);
  });

  it("menandai terjemahan yang dimulai tetapi belum selesai", () => {
    const h = hitungKelengkapan([
      { asal: "a", terjemahan: "a-en" },
      { asal: "b", terjemahan: null },
    ]);
    assert.equal(h.sebagian, true);
    assert.equal(h.persen, 50);
  });

  it("dokumen tanpa terjemahan sama sekali bukan 'sebagian'", () => {
    // Dokumen yang seluruhnya Indonesia adalah keadaan normal, bukan pekerjaan
    // separuh jalan. Membedakan keduanya yang membuat peringatan W8 berguna.
    const h = hitungKelengkapan([{ asal: "a", terjemahan: null }]);
    assert.equal(h.sebagian, false);
    assert.equal(h.total, 1);
  });

  it("dokumen kosong tidak membagi dengan nol", () => {
    assert.deepEqual(hitungKelengkapan([]), {
      terisi: 0,
      total: 0,
      persen: 0,
      sebagian: false,
    });
  });
});
