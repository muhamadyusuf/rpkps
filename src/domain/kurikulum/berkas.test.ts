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

describe("rakitKurikulum — profil lulusan", () => {
  function isiDenganProfil(): IsiBerkas {
    const isi = isiKodeBentrok();
    isi.profilLulusan = [
      { kode: "PL1", deskripsi: "Pengembang perangkat lunak untuk sistem informasi." },
      { kode: "PL2", deskripsi: "Analis data pada industri manufaktur." },
    ];
    isi.cpl[0].profilLulusanKode = "PL1, PL2";
    return isi;
  }

  it("merakit profil lulusan dan menyambungkannya dari lembar CPL", () => {
    const hasil = rakitKurikulum(isiDenganProfil(), META);

    assert.deepEqual(hasil.galat, []);
    assert.deepEqual(
      hasil.kurikulum.profilLulusan?.map((p) => p.kode),
      ["PL1", "PL2"],
    );
    assert.deepEqual(hasil.kurikulum.cpl[0].profilLulusanKode, ["PL1", "PL2"]);
  });

  it("kode ditulis huruf besar dan pemisah selain koma tetap dikenali", () => {
    const isi = isiDenganProfil();
    isi.cpl[0].profilLulusanKode = "pl1; pl2";

    const hasil = rakitKurikulum(isi, META);

    assert.deepEqual(hasil.kurikulum.cpl[0].profilLulusanKode, ["PL1", "PL2"]);
  });

  it("kode profil berulang ditolak dengan nomor barisnya", () => {
    const isi = isiDenganProfil();
    isi.profilLulusan!.push({ kode: "PL1", deskripsi: "Peran lain yang kodenya keliru." });

    const hasil = rakitKurikulum(isi, META);

    assert.equal(hasil.galat.length, 1);
    assert.equal(hasil.galat[0].lembar, "Profil Lulusan");
    assert.equal(hasil.galat[0].baris, 4);
    assert.match(hasil.galat[0].pesan, /berulang/);
    // Baris yang sah tetap terakit.
    assert.equal(hasil.kurikulum.profilLulusan?.length, 2);
  });

  it("kode kosong dan rumusan kosong dilaporkan terpisah", () => {
    const isi = isiDenganProfil();
    isi.profilLulusan = [
      { kode: "", deskripsi: "Rumusan tanpa kode." },
      { kode: "PL9", deskripsi: "   " },
    ];

    const hasil = rakitKurikulum(isi, META);

    assert.equal(hasil.galat.length, 2);
    assert.match(hasil.galat[0].pesan, /Kode profil lulusan kosong/);
    assert.match(hasil.galat[1].pesan, /rumusan profil kosong/i);
  });

  /**
   * Penjaga kompatibilitas: berkas yang diunduh sebelum lembar Profil Lulusan
   * ada tidak boleh gagal dirakit, dan tidak boleh menghasilkan galat palsu.
   */
  it("berkas tanpa lembar profil lulusan tetap terakit", () => {
    const hasil = rakitKurikulum(isiKodeBentrok(), META);

    assert.deepEqual(hasil.galat, []);
    assert.deepEqual(hasil.kurikulum.profilLulusan, []);
    assert.deepEqual(hasil.kurikulum.cpl[0].profilLulusanKode, []);
  });
});
