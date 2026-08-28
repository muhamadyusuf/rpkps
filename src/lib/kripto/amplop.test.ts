import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { bacaKek, buka, bungkus, ekorKunci, GalatKripto, samaAman } from "./amplop";

const kek = randomBytes(32);
const KUNCI = "sk-ant-api03-contoh-kunci-yang-cukup-panjang-4f2a";

describe("amplop kredensial", () => {
  it("bolak-balik mengembalikan rahasia yang sama persis", () => {
    assert.equal(buka(kek, bungkus(kek, KUNCI)), KUNCI);
  });

  it("dua pembungkusan atas rahasia yang sama menghasilkan gumpalan berbeda", () => {
    // DEK dan iv acak per pembungkusan: gumpalan identik akan membocorkan
    // bahwa dua dosen memakai kunci yang sama.
    assert.notEqual(bungkus(kek, KUNCI).toString("hex"), bungkus(kek, KUNCI).toString("hex"));
  });

  it("kunci master lain tidak dapat membukanya", () => {
    const gumpalan = bungkus(kek, KUNCI);
    assert.throws(() => buka(randomBytes(32), gumpalan), GalatKripto);
  });

  it("satu bita berubah pada cipherteks membuat pembukaan GAGAL, bukan menghasilkan sampah", () => {
    const gumpalan = bungkus(kek, KUNCI);
    gumpalan[gumpalan.length - 1] ^= 0x01;
    assert.throws(() => buka(kek, gumpalan), GalatKripto);
  });

  it("satu bita berubah pada DEK terbungkus juga gagal", () => {
    const gumpalan = bungkus(kek, KUNCI);
    gumpalan[40] ^= 0x01;
    assert.throws(() => buka(kek, gumpalan), GalatKripto);
  });

  it("versi tak dikenal ditolak, tidak dicoba dibuka", () => {
    const gumpalan = bungkus(kek, KUNCI);
    gumpalan[0] = 9;
    assert.throws(() => buka(kek, gumpalan), /Versi gumpalan 9/);
  });

  it("gumpalan terpenggal ditolak", () => {
    assert.throws(() => buka(kek, bungkus(kek, KUNCI).subarray(0, 50)), GalatKripto);
  });

  it("rahasia kosong tidak dibungkus", () => {
    assert.throws(() => bungkus(kek, ""), GalatKripto);
  });

  it("kunci master harus tepat 32 bita", () => {
    assert.throws(() => bungkus(randomBytes(16), KUNCI), GalatKripto);
    assert.throws(() => bacaKek(Buffer.from(randomBytes(16)).toString("base64")), /32 bita/);
  });

  it("bacaKek menerima base64 dari 32 bita acak", () => {
    const teks = randomBytes(32).toString("base64");
    assert.equal(bacaKek(teks).length, 32);
    assert.equal(bacaKek(` ${teks} `).length, 32);
  });

  it("ekor kunci hanya empat karakter terakhir", () => {
    assert.equal(ekorKunci(KUNCI), "4f2a");
    assert.equal(ekorKunci("  abcdef  "), "cdef");
  });

  it("perbandingan aman tetap benar untuk panjang berbeda", () => {
    assert.equal(samaAman("abc", "abc"), true);
    assert.equal(samaAman("abc", "abcd"), false);
    assert.equal(samaAman("abc", "abd"), false);
  });
});
