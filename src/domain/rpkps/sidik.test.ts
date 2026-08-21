import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungSidik, serialisasiKanonik, sidikRingkas } from "./sidik";

describe("sidik dokumen", () => {
  it("urutan kunci tidak memengaruhi hasil", () => {
    const a = { b: 1, a: 2, c: { z: 3, y: 4 } };
    const b = { c: { y: 4, z: 3 }, a: 2, b: 1 };
    assert.equal(serialisasiKanonik(a), serialisasiKanonik(b));
    assert.equal(hitungSidik(a), hitungSidik(b));
  });

  it("perubahan isi mengubah sidik", () => {
    const asli = { rumusan: "Mahasiswa mampu menjelaskan konsep basis data." };
    const diubah = { rumusan: "Mahasiswa mampu menjelaskan konsep basis data" };
    assert.notEqual(hitungSidik(asli), hitungSidik(diubah));
  });

  it("urutan larik TETAP berpengaruh — urutan pertemuan itu bermakna", () => {
    assert.notEqual(hitungSidik([1, 2, 3]), hitungSidik([3, 2, 1]));
  });

  it("tanggal diserialisasi stabil sebagai ISO", () => {
    const t = new Date("2026-08-19T10:00:00.000Z");
    assert.equal(serialisasiKanonik({ t }), '{"t":"2026-08-19T10:00:00.000Z"}');
  });

  it("objek dengan toJSON (mis. Decimal Prisma) ikut dinormalkan", () => {
    const decimalPalsu = { toJSON: () => "15.00" };
    assert.equal(serialisasiKanonik({ bobot: decimalPalsu }), '{"bobot":"15.00"}');
  });

  it("undefined diabaikan agar tidak mengubah sidik", () => {
    assert.equal(
      hitungSidik({ a: 1, b: undefined }),
      hitungSidik({ a: 1 }),
    );
  });

  it("sidik ringkas berbentuk dua blok delapan karakter", () => {
    const s = hitungSidik({ x: 1 });
    assert.match(sidikRingkas(s), /^[a-f0-9]{8} · [a-f0-9]{8}$/);
  });

  it("perubahan pada bagian mana pun ikut mengubah sidik", () => {
    // Penjaga terhadap kelalaian yang pernah terjadi: bagian baru ditambahkan
    // ke dokumen tetapi lupa dimasukkan ke proyeksi, sehingga sidiknya sama
    // untuk dua dokumen yang isinya berbeda.
    const dasar = { a: 1, kisiKisi: [{ jenis: "UTS", butir: [] as unknown[] }] };
    const berbeda = {
      a: 1,
      kisiKisi: [{ jenis: "UTS", butir: [{ nomor: 1, skor: 14 }] }],
    };
    assert.notEqual(hitungSidik(dasar), hitungSidik(berbeda));
  });

  it("sidik stabil antar pemanggilan", () => {
    const isi = { mk: "TI214", pertemuan: [{ minggu: 1, bobot: 5 }] };
    assert.equal(hitungSidik(isi), hitungSidik(structuredClone(isi)));
  });
});
