import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bagiProporsional, normalisasiKe100 } from "./normalisasi";

function jumlah(n: readonly number[]): number {
  return Math.round(n.reduce((s, x) => s + x, 0) * 100) / 100;
}

describe("normalisasi ke 100", () => {
  it("tidak menyentuh deret yang sudah tepat 100", () => {
    const h = normalisasiKe100([30, 20, 25, 25]);
    assert.equal(h.disesuaikan, false);
    assert.deepEqual(h.nilai, [30, 20, 25, 25]);
  });

  it("menurunkan total 110 menjadi 100 dengan proporsi tetap", () => {
    // Kasus yang dilaporkan dosen: bobot mingguan berjumlah 110%.
    const h = normalisasiKe100([20, 30, 25, 20, 15]);
    assert.equal(h.totalAsli, 110);
    assert.equal(h.disesuaikan, true);
    assert.equal(jumlah(h.nilai), 100);
    // Urutan besar-kecilnya dipertahankan.
    assert.ok(h.nilai[1] > h.nilai[2] && h.nilai[2] > h.nilai[0]);
  });

  it("menaikkan total yang kurang, bukan hanya menurunkan yang lebih", () => {
    const h = normalisasiKe100([40, 30, 20]);
    assert.equal(h.totalAsli, 90);
    assert.equal(jumlah(h.nilai), 100);
  });

  it("jumlahnya tepat 100 meski hasil bagi tidak bulat", () => {
    // 3 × 33,333… — pembulatan per angka akan memberi 99,99.
    const h = normalisasiKe100([33, 33, 33]);
    assert.equal(jumlah(h.nilai), 100);
    assert.deepEqual([...h.nilai].sort((a, b) => a - b), [33.33, 33.33, 33.34]);
  });

  it("membiarkan nol tetap nol — minggu tak dinilai tidak kebagian sisa", () => {
    const h = normalisasiKe100([0, 0, 35, 0, 35, 40]);
    assert.equal(jumlah(h.nilai), 100);
    assert.deepEqual([h.nilai[0], h.nilai[1], h.nilai[3]], [0, 0, 0]);
  });

  it("hasilnya sama tiap kali dijalankan untuk masukan yang sama", () => {
    const masukan = [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7];
    const a = normalisasiKe100(masukan);
    const b = normalisasiKe100(masukan);
    assert.deepEqual(a.nilai, b.nilai);
    assert.equal(jumlah(a.nilai), 100);
  });

  it("tidak menormalkan total yang jauh di luar akal — biar validator menolak", () => {
    for (const masukan of [[5, 5], [400, 500]]) {
      const h = normalisasiKe100(masukan);
      assert.equal(h.disesuaikan, false, `total ${jumlah(masukan)}`);
      assert.equal(h.diluarBatas, true);
      assert.deepEqual(h.nilai, masukan);
    }
  });

  it("deret kosong dan deret nol dibiarkan, tidak dibagi nol", () => {
    assert.deepEqual(normalisasiKe100([]).nilai, []);
    const h = normalisasiKe100([0, 0]);
    assert.equal(h.disesuaikan, false);
    assert.deepEqual(h.nilai, [0, 0]);
  });

  it("angka negatif dan bukan-bilangan diperlakukan sebagai nol", () => {
    const h = normalisasiKe100([60, -10, Number.NaN, 50]);
    assert.equal(jumlah(h.nilai), 100);
    assert.equal(h.nilai[1], 0);
    assert.equal(h.nilai[2], 0);
  });

  it("merapikan desimal panjang meski totalnya sudah 100", () => {
    const h = normalisasiKe100([33.333, 33.333, 33.334]);
    assert.equal(h.disesuaikan, true);
    assert.equal(jumlah(h.nilai), 100);
    assert.ok(h.nilai.every((n) => n === Math.round(n * 100) / 100));
  });
});

describe("bagi proporsional", () => {
  it("membagi bobot komponen ke barisnya dengan proporsi tetap", () => {
    assert.deepEqual(bagiProporsional(40, [10, 10]), [20, 20]);
    assert.deepEqual(bagiProporsional(30, [20, 10]), [20, 10]);
  });

  it("jumlahnya persis sama dengan total meski tidak habis dibagi", () => {
    const h = bagiProporsional(25, [1, 1, 1]);
    assert.equal(jumlah(h), 25);
    assert.deepEqual([...h].sort((a, b) => a - b), [8.33, 8.33, 8.34]);
  });

  it("anggota tanpa bobot usulan dibagi rata, bukan dibiarkan kosong", () => {
    // Komponen yang bobotnya tidak habis dibagikan akan muncul sebagai
    // PA-KOMPONEN-TIDAK-COCOK pada peta asesmen.
    assert.deepEqual(bagiProporsional(30, [0, 0]), [15, 15]);
  });

  it("anggota nol tetap nol selama ada anggota lain yang berbobot", () => {
    assert.deepEqual(bagiProporsional(30, [0, 10]), [0, 30]);
  });

  it("total nol atau daftar kosong tidak membagi nol", () => {
    assert.deepEqual(bagiProporsional(0, [10, 10]), [0, 0]);
    assert.deepEqual(bagiProporsional(30, []), []);
    assert.deepEqual(bagiProporsional(Number.NaN, [10]), [0]);
  });
});
