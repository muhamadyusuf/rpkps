import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  namaBerganti,
  rencanakanKomponen,
  type KomponenAda,
  type KomponenMasuk,
} from "./komponen-nilai";

const ada: KomponenAda[] = [
  { id: "k1", nama: "Tugas" },
  { id: "k2", nama: "UTS" },
  { id: "k3", nama: "UAS" },
];

/** Daftar yang sama persis dengan yang tersimpan, seperti dikirim formulir. */
const utuh: KomponenMasuk[] = [
  { id: "k1", nama: "Tugas", bobot: 30 },
  { id: "k2", nama: "UTS", bobot: 30 },
  { id: "k3", nama: "UAS", bobot: 40 },
];

describe("rencana komponen nilai", () => {
  it("menyimpan daftar yang tak berubah tanpa menghapus satu baris pun", () => {
    const r = rencanakanKomponen(utuh, ada);
    assert.deepEqual(r.hapus, []);
    assert.deepEqual(r.tambah, []);
    assert.deepEqual(
      r.perbarui.map((p) => p.id),
      ["k1", "k2", "k3"],
    );
  });

  it("mengubah satu bobot tidak menyentuh identitas baris lain", () => {
    const r = rencanakanKomponen(
      utuh.map((k) => (k.id === "k2" ? { ...k, bobot: 25 } : k)),
      ada,
    );
    assert.deepEqual(r.hapus, []);
    assert.equal(r.perbarui.find((p) => p.id === "k2")?.bobot, 25);
  });

  it("menambah komponen hanya menambah, tidak membuat ulang yang lama", () => {
    const r = rencanakanKomponen([...utuh, { id: null, nama: "Kuis", bobot: 10 }], ada);
    assert.deepEqual(r.hapus, []);
    assert.deepEqual(r.tambah, [{ nama: "Kuis", bobot: 10, urutan: 3 }]);
    assert.equal(r.perbarui.length, 3);
  });

  it("mengganti nama lewat id, bukan membuang barisnya", () => {
    const r = rencanakanKomponen(
      utuh.map((k) => (k.id === "k1" ? { ...k, nama: "Tugas Besar" } : k)),
      ada,
    );
    assert.deepEqual(r.hapus, []);
    assert.deepEqual(r.tambah, []);
    assert.equal(r.perbarui.find((p) => p.id === "k1")?.nama, "Tugas Besar");
  });

  it("hanya baris yang benar-benar hilang yang dihapus", () => {
    const r = rencanakanKomponen(
      utuh.filter((k) => k.id !== "k2"),
      ada,
    );
    assert.deepEqual(r.hapus, ["k2"]);
    assert.equal(r.perbarui.length, 2);
  });

  it("urutan mengikuti posisi baris pada daftar masukan", () => {
    const r = rencanakanKomponen([utuh[2], utuh[0], utuh[1]], ada);
    assert.deepEqual(
      r.perbarui.map((p) => [p.id, p.urutan]),
      [
        ["k3", 0],
        ["k1", 1],
        ["k2", 2],
      ],
    );
  });

  it("pemanggil tanpa id — penerapan draf AI — tetap dipasangkan lewat nama", () => {
    const r = rencanakanKomponen(
      [
        { id: null, nama: "Tugas", bobot: 40 },
        { id: null, nama: "UAS", bobot: 60 },
      ],
      ada,
    );
    assert.deepEqual(r.tambah, []);
    assert.deepEqual(r.hapus, ["k2"]);
    assert.deepEqual(
      r.perbarui.map((p) => p.id),
      ["k1", "k3"],
    );
  });

  it("baris kosong dibuang, bukan disimpan sebagai komponen tanpa nama", () => {
    const r = rencanakanKomponen([...utuh, { id: null, nama: "   ", bobot: 0 }], ada);
    assert.deepEqual(r.tambah, []);
    assert.equal(r.galat, null);
  });

  it("nama berulang ditolak sebelum apa pun ditulis", () => {
    const r = rencanakanKomponen(
      [...utuh, { id: null, nama: "UTS", bobot: 5 }],
      ada,
    );
    assert.equal(r.galat, "Nama komponen nilai tidak boleh berulang.");
    assert.deepEqual(r.hapus, []);
    assert.deepEqual(r.perbarui, []);
  });

  it("id yang tidak dikenal diperlakukan sebagai baris baru, bukan galat", () => {
    const r = rencanakanKomponen(
      [{ id: "hantu", nama: "Praktikum", bobot: 100 }],
      ada,
    );
    assert.deepEqual(r.tambah, [{ nama: "Praktikum", bobot: 100, urutan: 0 }]);
    assert.deepEqual(r.hapus, ["k1", "k2", "k3"]);
  });

  it("daftar dikosongkan berarti semua dihapus, tanpa yang tersisa", () => {
    const r = rencanakanKomponen([], ada);
    assert.deepEqual(r.hapus, ["k1", "k2", "k3"]);
    assert.deepEqual(r.perbarui, []);
  });
});

describe("penggantian nama", () => {
  it("menukar dua nama menandai keduanya, sehingga ditulis dua langkah", () => {
    const r = rencanakanKomponen(
      [
        { id: "k2", nama: "UAS", bobot: 30 },
        { id: "k3", nama: "UTS", bobot: 40 },
      ],
      ada,
    );
    assert.deepEqual(
      namaBerganti(r.perbarui, ada).map((p) => p.id),
      ["k2", "k3"],
    );
  });

  it("baris yang hanya berubah bobot tidak perlu langkah tambahan", () => {
    const r = rencanakanKomponen(
      utuh.map((k) => (k.id === "k1" ? { ...k, bobot: 15 } : k)),
      ada,
    );
    assert.deepEqual(namaBerganti(r.perbarui, ada), []);
  });
});
