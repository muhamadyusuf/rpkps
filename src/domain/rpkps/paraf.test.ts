import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capRonde, statusParaf, type BarisTtd, type PengampuParaf } from "./paraf";

const tim: PengampuParaf[] = [
  { penggunaId: "u1", nama: "Andi", koordinator: true },
  { penggunaId: "u2", nama: "Budi", koordinator: false },
  { penggunaId: "u3", nama: "Cita", koordinator: false },
];

const ttd = (
  versi: number,
  peran: BarisTtd["peran"],
  penggunaId: string,
  sidik = "sidik-a",
): BarisTtd => ({ versi, peran, penggunaId, sidik });

describe("kelengkapan paraf", () => {
  it("tanpa paraf sama sekali, seluruh tim masih ditunggu", () => {
    const s = statusParaf({ pengampu: tim, tandaTangan: [], versi: 1 });
    assert.equal(s.lengkap, false);
    assert.deepEqual(s.belum.map((p) => p.nama), ["Andi", "Budi", "Cita"]);
  });

  it("lengkap hanya bila semua pengampu memaraf", () => {
    const separuh = statusParaf({
      pengampu: tim,
      tandaTangan: [ttd(1, "PENGAMPU", "u1"), ttd(1, "PENGAMPU", "u2")],
      versi: 1,
    });
    assert.equal(separuh.lengkap, false);
    assert.deepEqual(separuh.belum.map((p) => p.nama), ["Cita"]);

    const penuh = statusParaf({
      pengampu: tim,
      tandaTangan: tim.map((p) => ttd(1, "PENGAMPU", p.penggunaId)),
      versi: 1,
    });
    assert.equal(penuh.lengkap, true);
    assert.equal(penuh.belum.length, 0);
  });

  it("paraf ronde sebelumnya gugur saat versi naik", () => {
    const tandaTangan = tim.map((p) => ttd(1, "PENGAMPU", p.penggunaId));
    assert.equal(statusParaf({ pengampu: tim, tandaTangan, versi: 1 }).lengkap, true);
    assert.equal(
      statusParaf({ pengampu: tim, tandaTangan, versi: 2 }).lengkap,
      false,
      "dokumen yang berubah harus ditandatangani ulang oleh semua orang",
    );
  });

  it("cap koordinator bukan paraf pengampu — keduanya dihitung terpisah", () => {
    const s = statusParaf({
      pengampu: tim,
      tandaTangan: [ttd(1, "KOORDINATOR", "u1")],
      versi: 1,
    });
    assert.equal(s.koordinatorSudah, true);
    assert.deepEqual(s.belum.map((p) => p.nama), ["Andi", "Budi", "Cita"]);
  });

  it("koordinator yang mengampu sendirian cukup satu paraf", () => {
    const sendiri = [tim[0]!];
    const s = statusParaf({
      pengampu: sendiri,
      tandaTangan: [ttd(1, "PENGAMPU", "u1")],
      versi: 1,
    });
    assert.equal(s.lengkap, true);
  });

  it("tim kosong tidak pernah disebut lengkap", () => {
    assert.equal(statusParaf({ pengampu: [], tandaTangan: [], versi: 1 }).lengkap, false);
  });
});

describe("cap ronde", () => {
  it("mengambil cap peran pada ronde berjalan saja", () => {
    const daftar = [ttd(1, "KAPRODI", "k1"), ttd(2, "KAPRODI", "k2")];
    assert.equal(capRonde(daftar, 2, "KAPRODI")?.penggunaId, "k2");
    assert.equal(capRonde(daftar, 3, "KAPRODI"), null);
    assert.equal(capRonde(daftar, 2, "PENJAMINAN_MUTU"), null);
  });
});

describe("paraf gugur saat isinya berubah", () => {
  const semua = tim.map((p) => ttd(1, "PENGAMPU", p.penggunaId, "sidik-a"));

  it("paraf atas isi yang sudah berbeda tidak dihitung", () => {
    const s = statusParaf({
      pengampu: tim,
      tandaTangan: semua,
      versi: 1,
      sidikSekarang: "sidik-b",
    });
    assert.equal(s.lengkap, false);
    assert.equal(s.belum.length, 3);
  });

  it("isi yang tidak berubah mempertahankan seluruh paraf", () => {
    const s = statusParaf({
      pengampu: tim,
      tandaTangan: semua,
      versi: 1,
      sidikSekarang: "sidik-a",
    });
    assert.equal(s.lengkap, true);
  });

  it("hanya yang memaraf isi lama yang ditunggu ulang", () => {
    const s = statusParaf({
      pengampu: tim,
      tandaTangan: [
        ttd(1, "PENGAMPU", "u1", "sidik-b"),
        ttd(1, "PENGAMPU", "u2", "sidik-b"),
        ttd(1, "PENGAMPU", "u3", "sidik-a"),
      ],
      versi: 1,
      sidikSekarang: "sidik-b",
    });
    assert.deepEqual(s.belum.map((p) => p.nama), ["Cita"]);
  });
});
