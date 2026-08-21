import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rakitKurikulum, type IsiBerkas } from "./berkas";

const META = { nama: "Kurikulum TI 2025", tahun: 2025 };

/**
 * Dua mata kuliah yang sama-sama memakai kode CPMK "CPMK01" — pola lazim di
 * buku kurikulum, dan sah menurut @@unique([mataKuliahId, kode]).
 */
function isiKodeBentrok(): IsiBerkas {
  return {
    cpl: [{ kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis dan sistematis." }],
    mk: [
      { kode: "TI214", nama: "Basis Data", semester: "2", sksTeori: "2", sksPraktik: "1", cplKode: "CPL06" },
      { kode: "TI310", nama: "Jaringan Komputer", semester: "3", sksTeori: "3", sksPraktik: "0", cplKode: "CPL06" },
    ],
    cpmk: [
      { mkKode: "TI214", kode: "CPMK01", rumusan: "Mampu merancang basis data.", levelBloom: "C6", cplKode: "CPL06" },
      { mkKode: "TI310", kode: "CPMK01", rumusan: "Mampu merancang topologi jaringan.", levelBloom: "C6", cplKode: "CPL06" },
    ],
    subCpmk: [],
  };
}

function cariMk(hasil: ReturnType<typeof rakitKurikulum>, kode: string) {
  const mk = hasil.kurikulum.mataKuliah.find((m) => m.kode === kode);
  assert.ok(mk, `mata kuliah ${kode} tidak terakit`);
  return mk;
}

describe("rakitKurikulum — rantai MK → CPMK → Sub-CPMK", () => {
  it("menerima kode CPMK yang sama pada dua mata kuliah berbeda", () => {
    const hasil = rakitKurikulum(isiKodeBentrok(), META);

    assert.deepEqual(hasil.galat, []);
    assert.equal(cariMk(hasil, "TI214").cpmk.length, 1);
    assert.equal(cariMk(hasil, "TI310").cpmk.length, 1);
  });

  it("menolak kode CPMK berulang di dalam SATU mata kuliah", () => {
    const isi = isiKodeBentrok();
    isi.cpmk[1].mkKode = "TI214";

    const hasil = rakitKurikulum(isi, META);

    assert.equal(hasil.galat.length, 1);
    assert.match(hasil.galat[0].pesan, /berulang pada mata kuliah TI214/);
    assert.equal(cariMk(hasil, "TI214").cpmk.length, 1);
  });

  it("menempelkan Sub-CPMK ke CPMK milik mata kuliah yang disebut", () => {
    const isi = isiKodeBentrok();
    isi.subCpmk = [
      { mkKode: "TI310", cpmkKode: "CPMK01", kode: "CPMK01-1", rumusan: "Mampu menggambar topologi bus.", levelBloom: "C3" },
    ];

    const hasil = rakitKurikulum(isi, META);

    assert.deepEqual(hasil.galat, []);
    assert.equal(cariMk(hasil, "TI214").cpmk[0].subCpmk.length, 0);
    assert.deepEqual(
      cariMk(hasil, "TI310").cpmk[0].subCpmk.map((s) => s.kode),
      ["CPMK01-1"],
    );
  });

  it("menolak Sub-CPMK yang menyebut mata kuliah tanpa CPMK tersebut", () => {
    const isi = isiKodeBentrok();
    isi.cpmk[1].kode = "CPMK02";
    isi.subCpmk = [
      { mkKode: "TI214", cpmkKode: "CPMK02", kode: "CPMK02-1", rumusan: "Mampu menggambar topologi bus.", levelBloom: "C3" },
    ];

    const hasil = rakitKurikulum(isi, META);

    assert.equal(hasil.galat.length, 1);
    assert.match(hasil.galat[0].pesan, /tidak ada pada mata kuliah TI214/);
  });
});

describe("rakitKurikulum — berkas lama tanpa kolom Kode MK", () => {
  it("menelusuri induk bila kode CPMK hanya dipakai satu mata kuliah", () => {
    const isi = isiKodeBentrok();
    isi.cpmk[1].kode = "CPMK02";
    isi.subCpmk = [
      { cpmkKode: "CPMK02", kode: "CPMK02-1", rumusan: "Mampu menggambar topologi bus.", levelBloom: "C3" },
    ];

    const hasil = rakitKurikulum(isi, META);

    assert.deepEqual(hasil.galat, []);
    assert.equal(cariMk(hasil, "TI310").cpmk[0].subCpmk.length, 1);
  });

  it("menolak sebagai ambigu — bukan menebak — bila kodenya dipakai banyak mata kuliah", () => {
    const isi = isiKodeBentrok();
    isi.subCpmk = [
      { cpmkKode: "CPMK01", kode: "CPMK01-1", rumusan: "Mampu menggambar topologi bus.", levelBloom: "C3" },
    ];

    const hasil = rakitKurikulum(isi, META);

    assert.equal(hasil.galat.length, 1);
    assert.match(hasil.galat[0].pesan, /TI214, TI310/);
    assert.match(hasil.galat[0].pesan, /Kode MK/);
    assert.equal(cariMk(hasil, "TI214").cpmk[0].subCpmk.length, 0);
    assert.equal(cariMk(hasil, "TI310").cpmk[0].subCpmk.length, 0);
  });
});
