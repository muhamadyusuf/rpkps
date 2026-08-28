import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { petaKomponenSubCpmk, susunPetaAsesmen, type SumberPeta } from "./peta-asesmen";

/**
 * Mata kuliah sehat: dua CPMK, empat Sub-CPMK, tiga komponen berjumlah 100%.
 * Bobot tugas mengalir lewat baris mingguan, ujian lewat kisi-kisi.
 */
function sumberSehat(): SumberPeta {
  return {
    komponenNilai: [
      { nama: "Tugas", bobot: 30 },
      { nama: "UTS", bobot: 30 },
      { nama: "UAS", bobot: 40 },
    ],
    pertemuan: [
      { minggu: 1, jenis: "EFEKTIF", penilaianJenis: null, bobot: 0, komponen: null, subCpmkKode: ["S1"] },
      { minggu: 2, jenis: "EFEKTIF", penilaianJenis: "Kuis 1", bobot: 10, komponen: "Tugas", subCpmkKode: ["S1"] },
      { minggu: 5, jenis: "EFEKTIF", penilaianJenis: "Laporan", bobot: 20, komponen: "Tugas", subCpmkKode: ["S2"] },
      { minggu: 8, jenis: "UTS", penilaianJenis: "UTS", bobot: 30, komponen: "UTS", subCpmkKode: [] },
      { minggu: 16, jenis: "UAS", penilaianJenis: "UAS", bobot: 40, komponen: "UAS", subCpmkKode: [] },
    ],
    tugas: [],
    kisiKisi: [
      { jenis: "UTS", butir: [{ subCpmkKode: "S1", skor: 50 }, { subCpmkKode: "S2", skor: 50 }] },
      { jenis: "UAS", butir: [{ subCpmkKode: "S3", skor: 60 }, { subCpmkKode: "S4", skor: 40 }] },
    ],
    cpmk: [
      { kode: "CPMK1", subCpmkKode: ["S1", "S2"], cplKode: ["CPL1"] },
      { kode: "CPMK2", subCpmkKode: ["S3", "S4"], cplKode: ["CPL2"] },
    ],
    cplDibebankan: ["CPL1", "CPL2"],
  };
}

function kode(hasil: { temuan: { kode: string }[] }): string[] {
  return hasil.temuan.map((t) => t.kode);
}

describe("peta asesmen sehat", () => {
  it("lolos tanpa pemblokir", () => {
    const h = susunPetaAsesmen(sumberSehat());
    assert.deepEqual(h.pemblokir, []);
    assert.equal(h.lolos, true);
  });

  it("menghasilkan satu asesmen per baris berbobot, mengabaikan yang nol", () => {
    const h = susunPetaAsesmen(sumberSehat());
    assert.deepEqual(
      h.asesmen.map((a) => a.kode),
      ["M2", "M5", "UTS", "UAS"],
    );
    assert.equal(h.ringkasan.totalBobot, 100);
  });

  it("membagi bobot ujian mengikuti skor butir kisi-kisi", () => {
    const h = susunPetaAsesmen(sumberSehat());
    const uts = h.asesmen.find((a) => a.kode === "UTS")!;
    assert.equal(uts.pembagian, "KISI_KISI");
    assert.deepEqual(uts.subCpmk, [
      { kode: "S1", bobot: 15 },
      { kode: "S2", bobot: 15 },
    ]);
  });

  it("menjumlahkan bobot sampai Sub-CPMK dan CPMK", () => {
    const h = susunPetaAsesmen(sumberSehat());
    assert.deepEqual(h.bobotSubCpmk, { S1: 25, S2: 35, S3: 24, S4: 16 });
    assert.deepEqual(h.bobotCpmk, { CPMK1: 60, CPMK2: 40 });
  });

  it("menurunkan kontribusi CPMK terhadap CPL dari bobot, bukan dari matriks kedua", () => {
    const h = susunPetaAsesmen(sumberSehat());
    const cpl1 = h.cpl.find((c) => c.kode === "CPL1")!;
    assert.equal(cpl1.bobot, 60);
    assert.deepEqual(cpl1.cpmk, [{ kode: "CPMK1", bobot: 60, kontribusi: 100 }]);
  });

  it("membagi kontribusi proporsional ketika satu CPL dijabarkan dua CPMK", () => {
    const s = sumberSehat();
    s.cpmk[1].cplKode = ["CPL1"];
    s.cplDibebankan = ["CPL1"];
    const h = susunPetaAsesmen(s);
    const cpl1 = h.cpl[0];
    assert.equal(cpl1.bobot, 100);
    assert.deepEqual(
      cpl1.cpmk.map((c) => c.kontribusi),
      [60, 40],
    );
  });
});

describe("hitung ganda antara lembar tugas dan tabel mingguan", () => {
  it("tidak menambahkan bobot tugas pada komponen yang sudah dirinci baris mingguan", () => {
    const s = sumberSehat();
    s.tugas = [
      {
        nomor: 1,
        nama: "Proyek basis data",
        bobot: 30,
        komponen: "Tugas",
        mingguMulai: 2,
        mingguSelesai: 5,
        subCpmkKode: ["S1", "S2"],
      },
    ];
    const h = susunPetaAsesmen(s);

    // Tanpa aturan ini totalnya menjadi 130%.
    assert.equal(h.ringkasan.totalBobot, 100);
    assert.equal(h.lolos, true);
    assert.ok(!h.asesmen.some((a) => a.kode === "T1"));
  });

  it("memperingatkan bila lembar tugas menyebut bobot yang berbeda", () => {
    const s = sumberSehat();
    s.tugas = [
      {
        nomor: 1,
        nama: "Proyek basis data",
        bobot: 25,
        komponen: "Tugas",
        mingguMulai: 2,
        mingguSelesai: 5,
        subCpmkKode: ["S1"],
      },
    ];
    const h = susunPetaAsesmen(s);
    assert.ok(kode(h).includes("PA-TUGAS-BEDA-BOBOT"));
    assert.equal(h.lolos, true); // peringatan, bukan pemblokir
    assert.equal(h.ringkasan.totalBobot, 100);
  });

  it("menjadikan tugas sebagai asesmen bila komponennya tidak dirinci baris mingguan", () => {
    const s = sumberSehat();
    s.komponenNilai = [
      { nama: "Tugas", bobot: 30 },
      { nama: "UTS", bobot: 30 },
      { nama: "UAS", bobot: 40 },
    ];
    s.pertemuan = s.pertemuan.filter((p) => p.komponen !== "Tugas");
    s.tugas = [
      {
        nomor: 1,
        nama: "Proyek basis data",
        bobot: 30,
        komponen: "Tugas",
        mingguMulai: 2,
        mingguSelesai: 5,
        subCpmkKode: ["S1", "S2"],
      },
    ];
    const h = susunPetaAsesmen(s);
    const t1 = h.asesmen.find((a) => a.kode === "T1")!;
    assert.equal(t1.bobot, 30);
    assert.deepEqual(t1.subCpmk, [
      { kode: "S1", bobot: 15 },
      { kode: "S2", bobot: 15 },
    ]);
    assert.deepEqual(t1.minggu, [2, 3, 4, 5]);
    assert.equal(h.ringkasan.totalBobot, 100);
  });
});

describe("bobot yang tidak dapat direkonsiliasi", () => {
  it("menolak baris berbobot yang tidak masuk komponen nilai", () => {
    const s = sumberSehat();
    s.pertemuan[1].komponen = null;
    const h = susunPetaAsesmen(s);
    assert.ok(kode(h).includes("PA-TANPA-KOMPONEN"));
    assert.equal(h.lolos, false);
  });

  it("menolak komponen yang tidak dirinci asesmen mana pun", () => {
    const s = sumberSehat();
    s.komponenNilai.push({ nama: "Kehadiran", bobot: 5 });
    const h = susunPetaAsesmen(s);
    assert.ok(kode(h).includes("PA-KOMPONEN-TANPA-ASESMEN"));
  });

  it("menolak komponen yang jumlah asesmennya tidak sama dengan bobotnya", () => {
    const s = sumberSehat();
    s.pertemuan[1].bobot = 5; // Tugas jadi 25%, komponennya tetap 30%
    const h = susunPetaAsesmen(s);
    const k = kode(h);
    assert.ok(k.includes("PA-KOMPONEN-TIDAK-COCOK"));
    assert.ok(k.includes("PA-TOTAL"));
  });

  it("menolak mata kuliah tanpa satu pun asesmen berbobot", () => {
    const s = sumberSehat();
    for (const p of s.pertemuan) p.bobot = 0;
    const h = susunPetaAsesmen(s);
    assert.ok(kode(h).includes("PA-KOSONG"));
  });
});

describe("bobot yang tidak mengalir ke capaian", () => {
  it("menolak asesmen berbobot yang tidak menagih Sub-CPMK", () => {
    const s = sumberSehat();
    s.kisiKisi = [];
    const h = susunPetaAsesmen(s);
    const k = kode(h);
    assert.ok(k.includes("PA-ASESMEN-TANPA-SUB-CPMK"));
    assert.equal(h.lolos, false);
  });

  it("membagi rata dan memperingatkan ketika ujian belum punya kisi-kisi", () => {
    const s = sumberSehat();
    s.kisiKisi = s.kisiKisi.filter((k) => k.jenis !== "UAS");
    s.pertemuan[4].subCpmkKode = ["S3", "S4"];
    const h = susunPetaAsesmen(s);

    const uas = h.asesmen.find((a) => a.kode === "UAS")!;
    assert.equal(uas.pembagian, "RATA");
    assert.deepEqual(uas.subCpmk, [
      { kode: "S3", bobot: 20 },
      { kode: "S4", bobot: 20 },
    ]);
    assert.ok(kode(h).includes("PA-UJIAN-TANPA-KISI-KISI"));
  });

  it("menolak Sub-CPMK yang tidak pernah mendapat bobot", () => {
    const s = sumberSehat();
    s.cpmk[1].subCpmkKode = ["S3", "S4", "S5"];
    const h = susunPetaAsesmen(s);
    const t = h.temuan.find((x) => x.kode === "PA-SUB-CPMK-TANPA-BOBOT")!;
    assert.ok(t.pesan.includes("S5"));
    assert.equal(h.ringkasan.subCpmkTerukur, 4);
    assert.equal(h.ringkasan.subCpmkSeluruh, 5);
  });

  it("menolak Sub-CPMK asing yang ditagih asesmen", () => {
    const s = sumberSehat();
    s.pertemuan[1].subCpmkKode = ["SX"];
    const h = susunPetaAsesmen(s);
    assert.ok(kode(h).includes("PA-SUB-CPMK-ASING"));
  });

  it("menolak CPL yang dibebankan tetapi tidak pernah dinilai (B3 pada docs/02)", () => {
    const s = sumberSehat();
    s.cplDibebankan = ["CPL1", "CPL2", "CPL6"];
    const h = susunPetaAsesmen(s);
    const t = h.temuan.find((x) => x.kode === "PA-CPL-TANPA-BOBOT")!;
    assert.ok(t.pesan.includes("CPL6"));
    assert.equal(h.ringkasan.cplTerukur, 2);
    assert.equal(h.ringkasan.cplDibebankan, 3);
  });
});

describe("tabel distribusi penilaian (bagian E)", () => {
  it("mengisi kolom ujian dari kisi-kisi, bukan dari Sub-CPMK baris mingguan", () => {
    // Baris UTS/UAS pada tabel mingguan memang tidak menempel Sub-CPMK.
    // Sebelum peta asesmen, kolom UTS dan UAS pada tabel distribusi selalu
    // kosong — dokumen menyatakan ujian tidak mengukur capaian apa pun.
    const s = sumberSehat();
    assert.deepEqual(s.pertemuan[3].subCpmkKode, []);
    assert.deepEqual(s.pertemuan[4].subCpmkKode, []);

    const peta = petaKomponenSubCpmk(susunPetaAsesmen(s));
    assert.deepEqual([...(peta.get("UTS") ?? [])], ["S1", "S2"]);
    assert.deepEqual([...(peta.get("UAS") ?? [])], ["S3", "S4"]);
  });

  it("mengisi kolom tugas dari baris mingguan yang merincinya", () => {
    const peta = petaKomponenSubCpmk(susunPetaAsesmen(sumberSehat()));
    assert.deepEqual([...(peta.get("Tugas") ?? [])], ["S1", "S2"]);
  });

  it("mengambil dari lembar tugas ketika komponen itu yang merincinya", () => {
    const s = sumberSehat();
    s.pertemuan = s.pertemuan.filter((p) => p.komponen !== "Tugas");
    s.tugas = [
      {
        nomor: 1,
        nama: "Proyek",
        bobot: 30,
        komponen: "Tugas",
        mingguMulai: 9,
        mingguSelesai: 12,
        subCpmkKode: ["S3"],
      },
    ];
    const peta = petaKomponenSubCpmk(susunPetaAsesmen(s));
    assert.deepEqual([...(peta.get("Tugas") ?? [])], ["S3"]);
  });

  it("tidak menandai komponen yang asesmennya belum ditunjuk", () => {
    const s = sumberSehat();
    s.pertemuan[3].komponen = null;
    const peta = petaKomponenSubCpmk(susunPetaAsesmen(s));
    assert.equal(peta.has("UTS"), false);
  });
});
