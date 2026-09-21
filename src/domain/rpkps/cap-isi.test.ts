import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capIsiRpkps } from "./cap-isi";

describe("capIsiRpkps", () => {
  const dasar = () => ({
    rpkpsDiubah: new Date("2026-09-01T00:00:00Z"),
    pertemuan: [{ id: "a", diubahPada: new Date("2026-09-01T00:00:00Z") }],
    tugas: [{ id: "t", diubahPada: new Date("2026-09-01T00:00:00Z") }],
    kisiKisi: [],
    komponen: [{ nama: "Tugas", bobot: 100 }],
    jumlahPustaka: 1,
  });

  it("stabil untuk isi yang sama, apa pun urutan barisnya", () => {
    const a = dasar();
    const b = dasar();
    b.pertemuan.push({ id: "b", diubahPada: new Date("2026-09-02T00:00:00Z") });
    a.pertemuan.unshift(b.pertemuan[1]);
    b.pertemuan = [b.pertemuan[0], b.pertemuan[1]];
    assert.equal(capIsiRpkps(a), capIsiRpkps(b));
  });

  it("bergeser bila baris disunting, dihapus, atau komponen berubah", () => {
    const asal = capIsiRpkps(dasar());
    const disunting = dasar();
    disunting.pertemuan[0].diubahPada = new Date("2026-09-03T00:00:00Z");
    const dihapus = dasar();
    dihapus.tugas = [];
    const komponen = dasar();
    komponen.komponen = [{ nama: "Tugas", bobot: 90 }];
    for (const lain of [disunting, dihapus, komponen]) assert.notEqual(capIsiRpkps(lain), asal);
  });
});
