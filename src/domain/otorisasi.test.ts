import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adalahAdmin,
  bolehBuatRpkpsDiProdi,
  bolehKelolaKurikulum,
  cakupanKurikulum,
  cakupanProdi,
  punyaPeran,
  punyaPeranDiProdi,
  type SesiOtorisasi,
} from "./otorisasi";

const TI = "prodi-teknologi-informasi";
const SI = "prodi-sistem-informasi";

function sesi(...penugasan: SesiOtorisasi["penugasan"]): SesiOtorisasi {
  return { penugasan, daftarPeran: [...new Set(penugasan.map((p) => p.peran))] };
}

describe("membaca kurikulum dan membuat RPKPS lintas prodi", () => {
  for (const peran of ["DOSEN", "KOORDINATOR_MK", "KAPRODI"] as const) {
    it(`${peran} TI boleh memilih kurikulum SI tanpa memperluas cakupan dasar`, () => {
      const pengguna = sesi({ peran, prodiId: TI });
      assert.deepEqual(cakupanProdi(pengguna), [TI]);
      assert.equal(cakupanKurikulum(pengguna), null);
      assert.equal(bolehBuatRpkpsDiProdi(pengguna, TI), true);
      assert.equal(bolehBuatRpkpsDiProdi(pengguna, SI), true);
      assert.equal(bolehKelolaKurikulum(pengguna, SI), false);
    });
  }

  it("admin tetap boleh membaca, membuat, dan mengelola seluruh prodi", () => {
    const pengguna = sesi({ peran: "ADMIN", prodiId: null });
    assert.equal(adalahAdmin(pengguna), true);
    assert.equal(cakupanProdi(pengguna), null);
    assert.equal(cakupanKurikulum(pengguna), null);
    for (const prodiId of [TI, SI]) {
      assert.equal(bolehBuatRpkpsDiProdi(pengguna, prodiId), true);
      assert.equal(bolehKelolaKurikulum(pengguna, prodiId), true);
    }
  });

  for (const peran of ["GPM", "ASESOR"] as const) {
    it(`${peran} tetap membaca seluruh prodi tanpa izin membuat atau mengelola`, () => {
      const pengguna = sesi({ peran, prodiId: null });
      assert.equal(cakupanProdi(pengguna), null);
      assert.equal(cakupanKurikulum(pengguna), null);
      for (const prodiId of [TI, SI]) {
        assert.equal(bolehBuatRpkpsDiProdi(pengguna, prodiId), false);
        assert.equal(bolehKelolaKurikulum(pengguna, prodiId), false);
      }
    });
  }

  it("mahasiswa tetap membaca dalam cakupannya tanpa izin membuat", () => {
    const pengguna = sesi({ peran: "MAHASISWA", prodiId: TI });
    assert.deepEqual(cakupanKurikulum(pengguna), [TI]);
    for (const prodiId of [TI, SI]) {
      assert.equal(bolehBuatRpkpsDiProdi(pengguna, prodiId), false);
      assert.equal(bolehKelolaKurikulum(pengguna, prodiId), false);
    }
  });

  for (const [nama, pengguna] of [["tanpa sesi", null], ["tanpa peran", sesi()]] as const) {
    it(`${nama} tidak memperoleh akses`, () => {
      assert.deepEqual(cakupanProdi(pengguna), []);
      assert.deepEqual(cakupanKurikulum(pengguna), []);
      assert.equal(bolehBuatRpkpsDiProdi(pengguna, TI), false);
      assert.equal(bolehKelolaKurikulum(pengguna, TI), false);
      assert.equal(punyaPeran(pengguna, "DOSEN"), false);
      assert.equal(punyaPeranDiProdi(pengguna, TI, "KAPRODI"), false);
      assert.equal(adalahAdmin(pengguna), false);
    });
  }
});

describe("hak kelola mengikuti penugasan jabatan", () => {
  it("Kaprodi TI hanya mengelola TI meskipun menjadi dosen SI", () => {
    const pengguna = sesi(
      { peran: "KAPRODI", prodiId: TI },
      { peran: "DOSEN", prodiId: SI },
    );
    assert.deepEqual(cakupanProdi(pengguna), [TI, SI]);
    assert.equal(cakupanKurikulum(pengguna), null);
    assert.equal(bolehBuatRpkpsDiProdi(pengguna, SI), true);
    assert.equal(bolehKelolaKurikulum(pengguna, TI), true);
    assert.equal(bolehKelolaKurikulum(pengguna, SI), false);
  });

  it("cakupan institusi GPM tidak memperluas jabatan Kaprodi TI", () => {
    const pengguna = sesi(
      { peran: "KAPRODI", prodiId: TI },
      { peran: "GPM", prodiId: null },
    );
    assert.equal(cakupanProdi(pengguna), null);
    assert.equal(cakupanKurikulum(pengguna), null);
    assert.equal(bolehKelolaKurikulum(pengguna, TI), true);
    assert.equal(bolehKelolaKurikulum(pengguna, SI), false);
  });

  it("Kaprodi yang ditugaskan pada dua prodi boleh mengelola keduanya", () => {
    const pengguna = sesi(
      { peran: "KAPRODI", prodiId: TI },
      { peran: "KAPRODI", prodiId: SI },
      { peran: "DOSEN", prodiId: TI },
    );
    assert.deepEqual(cakupanProdi(pengguna), [TI, SI]);
    assert.equal(bolehKelolaKurikulum(pengguna, TI), true);
    assert.equal(bolehKelolaKurikulum(pengguna, SI), true);
  });

  it("penugasan jabatan tanpa prodi tetap berlaku untuk seluruh institusi", () => {
    const pengguna = sesi({ peran: "KAPRODI", prodiId: null });
    assert.equal(punyaPeranDiProdi(pengguna, TI, "KAPRODI"), true);
    assert.equal(punyaPeranDiProdi(pengguna, SI, "KAPRODI"), true);
    assert.equal(bolehKelolaKurikulum(pengguna, SI), true);
  });
});
