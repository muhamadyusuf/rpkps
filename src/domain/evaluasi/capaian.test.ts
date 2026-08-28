import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungCapaian, PITA_BAWAAN, type SumberCapaian } from "./capaian";
import type { Asesmen } from "./peta-asesmen";

/**
 * Dua CPMK, empat Sub-CPMK, empat asesmen berjumlah 100%.
 * S1 dinilai M2 (10) dan UTS (15); S2 oleh M5 (20) dan UTS (15);
 * S3 dan S4 oleh UAS (24 dan 16).
 */
const ASESMEN: Asesmen[] = [
  { kode: "M2", nama: "Kuis 1", asal: "MINGGUAN", komponen: "Tugas", bobot: 10, minggu: [2], subCpmk: [{ kode: "S1", bobot: 10 }], pembagian: "RATA" },
  { kode: "M5", nama: "Laporan", asal: "MINGGUAN", komponen: "Tugas", bobot: 20, minggu: [5], subCpmk: [{ kode: "S2", bobot: 20 }], pembagian: "RATA" },
  { kode: "UTS", nama: "UTS", asal: "UJIAN", komponen: "UTS", bobot: 30, minggu: [8], subCpmk: [{ kode: "S1", bobot: 15 }, { kode: "S2", bobot: 15 }], pembagian: "KISI_KISI" },
  { kode: "UAS", nama: "UAS", asal: "UJIAN", komponen: "UAS", bobot: 40, minggu: [16], subCpmk: [{ kode: "S3", bobot: 24 }, { kode: "S4", bobot: 16 }], pembagian: "KISI_KISI" },
];

function sumber(
  peserta: SumberCapaian["peserta"],
  ubah: Partial<SumberCapaian> = {},
): SumberCapaian {
  return {
    asesmen: ASESMEN,
    cpmk: [
      { kode: "CPMK1", subCpmkKode: ["S1", "S2"], cplKode: ["CPL1"] },
      { kode: "CPMK2", subCpmkKode: ["S3", "S4"], cplKode: ["CPL2"] },
    ],
    cplDibebankan: ["CPL1", "CPL2"],
    peserta,
    ambangKelulusanMhs: 55,
    ambangKetercapaianMk: 85,
    ...ubah,
  };
}

function penuh(nilai: number) {
  return { M2: nilai, M5: nilai, UTS: nilai, UAS: nilai };
}

describe("perhitungan per mahasiswa", () => {
  it("merata-rata berbobot dari asesmen ke Sub-CPMK", () => {
    const h = hitungCapaian(
      sumber([{ nim: "1101", nama: "Ali", skor: { M2: 90, M5: 60, UTS: 70, UAS: 80 } }]),
    );
    const m = h.mahasiswa[0];
    // S1: (90×10 + 70×15) / 25 = 78
    assert.equal(m.subCpmk.S1, 78);
    // S2: (60×20 + 70×15) / 35 = 64,29
    assert.equal(m.subCpmk.S2, 64.29);
    // S3 dan S4 sama-sama dari UAS
    assert.equal(m.subCpmk.S3, 80);
    assert.equal(m.subCpmk.S4, 80);
  });

  it("menaikkan Sub-CPMK ke CPMK menurut bobot Sub-CPMK", () => {
    const h = hitungCapaian(
      sumber([{ nim: "1101", nama: "Ali", skor: { M2: 90, M5: 60, UTS: 70, UAS: 80 } }]),
    );
    // CPMK1: (78×25 + 64,29×35) / 60 = 70,00
    assert.equal(h.mahasiswa[0].cpmk.CPMK1, 70);
    assert.equal(h.mahasiswa[0].cpmk.CPMK2, 80);
  });

  it("menurunkan capaian CPL dari kontribusi CPMK", () => {
    const h = hitungCapaian(sumber([{ nim: "1101", nama: "Ali", skor: penuh(75) }]));
    assert.equal(h.mahasiswa[0].cpl.CPL1, 75);
    assert.equal(h.mahasiswa[0].cpl.CPL2, 75);
  });

  it("menghitung nilai akhir dari bobot asesmen", () => {
    const h = hitungCapaian(
      sumber([{ nim: "1101", nama: "Ali", skor: { M2: 100, M5: 50, UTS: 60, UAS: 70 } }]),
    );
    // (100×10 + 50×20 + 60×30 + 70×40) / 100 = 66
    assert.equal(h.mahasiswa[0].nilaiAkhir, 66);
    assert.equal(h.mahasiswa[0].kelengkapan, 100);
  });

  it("mengabaikan asesmen yang belum dinilai, bukan menganggapnya nol", () => {
    const h = hitungCapaian(
      sumber([{ nim: "1101", nama: "Ali", skor: { M2: 80, M5: null, UTS: 80, UAS: null } }]),
    );
    const m = h.mahasiswa[0];
    assert.equal(m.subCpmk.S1, 80); // M2 dan UTS terisi
    assert.equal(m.subCpmk.S2, 80); // hanya UTS yang terisi
    assert.equal(m.subCpmk.S3, null); // UAS kosong
    assert.equal(m.nilaiAkhir, 80);
    assert.equal(m.kelengkapan, 40); // bobot 10 + 30 dari 100
  });
});

describe("dua ambang menjawab dua pertanyaan", () => {
  it("memisahkan rerata tinggi dari sebaran yang timpang", () => {
    // Rerata 70, tetapi separuh kelas gagal. Rata-rata saja menyembunyikan ini.
    const h = hitungCapaian(
      sumber([
        { nim: "1", nama: "A", skor: penuh(95) },
        { nim: "2", nama: "B", skor: penuh(95) },
        { nim: "3", nama: "C", skor: penuh(45) },
        { nim: "4", nama: "D", skor: penuh(45) },
      ]),
    );
    const cpmk1 = h.butir.find((b) => b.tingkat === "CPMK" && b.kode === "CPMK1")!;
    assert.equal(cpmk1.rerata, 70);
    assert.equal(cpmk1.persenLulus, 50);
    assert.equal(cpmk1.tercapai, false);
    assert.equal(cpmk1.pita, "BAIK");
  });

  it("menyatakan tercapai ketika proporsi lulus mencapai ambang", () => {
    const peserta = Array.from({ length: 10 }, (_, i) => ({
      nim: String(i),
      nama: `M${i}`,
      skor: penuh(i < 9 ? 70 : 40),
    }));
    const h = hitungCapaian(sumber(peserta));
    const cpmk1 = h.butir.find((b) => b.kode === "CPMK1")!;
    assert.equal(cpmk1.persenLulus, 90);
    assert.equal(cpmk1.tercapai, true);
  });

  it("menghormati ambang yang berbeda", () => {
    const peserta = Array.from({ length: 10 }, (_, i) => ({
      nim: String(i),
      nama: `M${i}`,
      skor: penuh(i < 7 ? 70 : 40),
    }));
    const ketat = hitungCapaian(sumber(peserta));
    const longgar = hitungCapaian(sumber(peserta, { ambangKetercapaianMk: 70 }));
    assert.equal(ketat.butir.find((b) => b.kode === "CPMK1")!.tercapai, false);
    assert.equal(longgar.butir.find((b) => b.kode === "CPMK1")!.tercapai, true);
  });

  it("memetakan rerata ke pita", () => {
    const pita = (n: number) =>
      hitungCapaian(sumber([{ nim: "1", nama: "A", skor: penuh(n) }])).butir.find(
        (b) => b.kode === "CPMK1",
      )!.pita;
    assert.equal(pita(90), "SANGAT BAIK");
    assert.equal(pita(75), "BAIK");
    assert.equal(pita(60), "SEDANG");
    assert.equal(pita(40), "KURANG");
    assert.equal(PITA_BAWAAN.length, 4);
  });
});

describe("kesiapan untuk ditutup", () => {
  it("menolak kelas tanpa peserta", () => {
    const h = hitungCapaian(sumber([]));
    assert.ok(h.temuan.some((t) => t.kode === "EV-TANPA-PESERTA"));
    assert.equal(h.dapatDitutup, false);
  });

  it("menolak penutupan di atas data sebagian", () => {
    const h = hitungCapaian(
      sumber([{ nim: "1101", nama: "Ali", skor: { M2: 80, M5: 80, UTS: 80, UAS: null } }]),
    );
    const t = h.temuan.find((x) => x.kode === "EV-BELUM-LENGKAP")!;
    assert.ok(t.pesan.includes("1 dari 4"));
    assert.equal(h.dapatDitutup, false);
    // Angkanya tetap dihitung, hanya penutupannya yang ditahan.
    assert.equal(h.mahasiswa[0].cpmk.CPMK1, 80);
  });

  it("meloloskan kelas yang lengkap dan menyebut CPMK yang belum tercapai", () => {
    const h = hitungCapaian(
      sumber([
        { nim: "1", nama: "A", skor: { M2: 90, M5: 90, UTS: 90, UAS: 40 } },
        { nim: "2", nama: "B", skor: { M2: 90, M5: 90, UTS: 90, UAS: 40 } },
      ]),
    );
    assert.equal(h.dapatDitutup, true);
    assert.deepEqual(h.ringkasan.cpmkBelumTercapai, ["CPMK2"]);
    assert.equal(h.ringkasan.cpmkTercapai, 1);
    assert.equal(h.ringkasan.cpmkSeluruh, 2);
    assert.equal(h.ringkasan.cplTercapai, 1);
    assert.ok(h.temuan.some((t) => t.kode === "EV-CPMK-BELUM-TERCAPAI"));
  });

  it("menyimpulkan ringkasan kelas", () => {
    const h = hitungCapaian(
      sumber([
        { nim: "1", nama: "A", skor: penuh(80) },
        { nim: "2", nama: "B", skor: penuh(60) },
      ]),
    );
    assert.equal(h.ringkasan.jumlahPeserta, 2);
    assert.equal(h.ringkasan.kelengkapan, 100);
    assert.equal(h.ringkasan.rerataNilaiAkhir, 70);
    assert.deepEqual(h.ringkasan.cpmkBelumTercapai, []);
  });
});
