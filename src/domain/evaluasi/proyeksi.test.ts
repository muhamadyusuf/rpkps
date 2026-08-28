import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proyeksiEvaluasi, sidikEvaluasi, type SumberProyeksiEvaluasi } from "./proyeksi";

function sumber(): SumberProyeksiEvaluasi {
  return {
    mk: { kode: "TI214", nama: "Basis Data" },
    tahunAkademik: "2025/2026-GENAP",
    kelas: "A",
    dosen: "Muhamad Yusuf",
    ambangKelulusanMhs: 55,
    ambangKetercapaianMk: 85,
    catatanProses: "Dua pertemuan terakhir terpotong libur nasional.",
    asesmen: [
      { kode: "UTS", nama: "UTS", asal: "UJIAN", komponen: "UTS", bobot: 40, minggu: [8], subCpmk: [{ kode: "S2", bobot: 20 }, { kode: "S1", bobot: 20 }], pembagian: "KISI_KISI" },
      { kode: "M2", nama: "Kuis", asal: "MINGGUAN", komponen: "Tugas", bobot: 60, minggu: [2], subCpmk: [{ kode: "S1", bobot: 60 }], pembagian: "RATA" },
    ],
    butir: [
      { tingkat: "CPMK", kode: "CPMK1", rerata: 72, persenLulus: 90, tercapai: true, pita: "BAIK", jumlahDinilai: 20 },
      { tingkat: "SUB_CPMK", kode: "S1", rerata: 75, persenLulus: 95, tercapai: true, pita: "BAIK", jumlahDinilai: 20 },
    ],
    mahasiswa: [
      { nim: "1102", nama: "Budi", subCpmk: { S1: 60 }, cpmk: { CPMK1: 60 }, cpl: { CPL1: 60 }, nilaiAkhir: 60, kelengkapan: 100 },
      { nim: "1101", nama: "Ali", subCpmk: { S1: 80 }, cpmk: { CPMK1: 80 }, cpl: { CPL1: 80 }, nilaiAkhir: 80, kelengkapan: 100 },
    ],
    temuan: [],
  };
}

describe("proyeksi evaluasi", () => {
  it("mengurutkan isinya supaya sidik tidak bergantung urutan kueri", () => {
    const p = proyeksiEvaluasi(sumber());
    assert.deepEqual(p.asesmen.map((a) => a.kode), ["M2", "UTS"]);
    assert.deepEqual(p.mahasiswa.map((m) => m.nim), ["1101", "1102"]);
    assert.deepEqual(p.butir.map((b) => b.kode), ["CPMK1", "S1"]);
    assert.deepEqual(p.asesmen[1].subCpmk.map((s) => s.kode), ["S1", "S2"]);
  });

  it("tidak memuat kelengkapan per mahasiswa — itu keadaan, bukan hasil", () => {
    const p = proyeksiEvaluasi(sumber());
    assert.ok(!("kelengkapan" in p.mahasiswa[0]));
  });

  it("menghasilkan sidik yang stabil terhadap urutan masukan", () => {
    const a = sumber();
    const b = sumber();
    b.mahasiswa = [...b.mahasiswa].reverse();
    b.asesmen = [...b.asesmen].reverse();
    assert.equal(sidikEvaluasi(a), sidikEvaluasi(b));
  });

  it("menggeser sidik ketika angka capaian berubah", () => {
    const a = sumber();
    const b = sumber();
    b.butir = [{ ...b.butir[0], persenLulus: 80, tercapai: false }, b.butir[1]];
    assert.notEqual(sidikEvaluasi(a), sidikEvaluasi(b));
  });

  it("menggeser sidik ketika ambang berbeda", () => {
    const a = sumber();
    const b = { ...sumber(), ambangKetercapaianMk: 70 };
    assert.notEqual(sidikEvaluasi(a), sidikEvaluasi(b));
  });
});
