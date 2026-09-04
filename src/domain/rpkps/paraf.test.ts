import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capRonde,
  rantaiPengesahan,
  RANTAI_PENGESAHAN,
  statusParaf,
  type BarisTtd,
  type PengampuParaf,
} from "./paraf";

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

describe("rantai pengesahan", () => {
  const lengkap: BarisTtd[] = [
    ttd(2, "PENJAMINAN_MUTU", "u9"),
    ttd(2, "KOORDINATOR", "u1"),
    ttd(2, "KAPRODI", "u7"),
  ];

  it("selalu bertiga dan selalu berurutan, apa pun urutan barisnya", () => {
    const r = rantaiPengesahan(lengkap, 2);
    assert.deepEqual(r.map((s) => s.peran), [...RANTAI_PENGESAHAN]);
    assert.deepEqual(r.map((s) => s.cap?.penggunaId), ["u1", "u7", "u9"]);
  });

  it("blok yang belum ditandatangani tetap ada, dan kosong", () => {
    /*
     * Yang kosong justru bagian yang paling perlu terbaca: dokumen yang terbit
     * sebelum rantai ini ada tidak diberi tanda tangan susulan (docs/14 §5).
     */
    const r = rantaiPengesahan([ttd(1, "KOORDINATOR", "u1")], 1);
    assert.equal(r.length, 3);
    assert.deepEqual(r.map((s) => s.cap === null), [false, true, true]);
  });

  it("paraf pengampu bukan bagian rantai", () => {
    const r = rantaiPengesahan([ttd(1, "PENGAMPU", "u1"), ttd(1, "PENGAMPU", "u2")], 1);
    assert.deepEqual(r.map((s) => s.cap), [null, null, null]);
  });

  it("cap ronde lain tidak ikut terbawa", () => {
    // Pengembalian untuk revisi menaikkan versi, dan kenaikan itulah yang
    // menggugurkan ronde sebelumnya — barisnya tidak pernah dihapus.
    assert.deepEqual(
      rantaiPengesahan(lengkap, 3).map((s) => s.cap),
      [null, null, null],
    );
  });
});
