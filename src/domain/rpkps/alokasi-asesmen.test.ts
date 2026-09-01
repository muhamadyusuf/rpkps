import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { susunPetaAsesmen, type SumberPeta } from "@/domain/evaluasi/peta-asesmen";
import { alokasikanAsesmen, type MasukanAlokasi } from "./alokasi-asesmen";

/**
 * Mata kuliah contoh: enam minggu, UTS di minggu 3 dan UAS di minggu 6,
 * empat Sub-CPMK yang dijadwalkan pada empat minggu efektif.
 */
function masukan(ubah: Partial<MasukanAlokasi> = {}): MasukanAlokasi {
  return {
    komponen: [
      { nama: "Tugas", bobot: 40 },
      { nama: "UTS", bobot: 25 },
      { nama: "UAS", bobot: 35 },
    ],
    baris: [
      { minggu: 1, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
      { minggu: 2, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
      { minggu: 3, jenis: "UTS", bobot: 25, komponen: "UTS" },
      { minggu: 4, jenis: "EFEKTIF", bobot: 0, komponen: null },
      { minggu: 5, jenis: "EFEKTIF", bobot: 0, komponen: null },
      { minggu: 6, jenis: "UAS", bobot: 35, komponen: "UAS" },
    ],
    tugas: [
      { nomor: 1, mingguMulai: 1, mingguSelesai: 2, bobot: 40, komponen: "Tugas" },
    ],
    kisiKisiBerisi: ["UTS", "UAS"],
    mingguBerSubCpmk: [1, 2, 4, 5],
    ...ubah,
  };
}

function jumlah(n: readonly number[]): number {
  return Math.round(n.reduce((s, x) => s + x, 0) * 100) / 100;
}

describe("alokasikanAsesmen — draf yang sudah benar", () => {
  it("tidak mengubah apa pun dan tidak menulis satu catatan pun", () => {
    const h = alokasikanAsesmen(masukan());
    assert.deepEqual(h.catatan, []);
    assert.deepEqual(h.komponen, [
      { nama: "Tugas", bobot: 40 },
      { nama: "UTS", bobot: 25 },
      { nama: "UAS", bobot: 35 },
    ]);
    assert.deepEqual(
      h.baris.map((b) => [b.minggu, b.bobot, b.komponen]),
      [
        [1, 20, "Tugas"],
        [2, 20, "Tugas"],
        [3, 25, "UTS"],
        [4, 0, null],
        [5, 0, null],
        [6, 35, "UAS"],
      ],
    );
    assert.equal(h.tugas[0].bobot, 40);
  });
});

describe("alokasikanAsesmen — komponen nilai tetap buku besarnya", () => {
  it("membagi bobot komponen ke barisnya, bukan sebaliknya", () => {
    // Model menulis 10 + 10 untuk komponen yang dirancangnya 40.
    const h = alokasikanAsesmen(
      masukan({
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 10, komponen: "Tugas" },
          { minggu: 2, jenis: "EFEKTIF", bobot: 10, komponen: "Tugas" },
          { minggu: 3, jenis: "UTS", bobot: 25, komponen: "UTS" },
          { minggu: 6, jenis: "UAS", bobot: 35, komponen: "UAS" },
        ],
      }),
    );
    // Bobot komponen bulat seperti rancangan model; barisnya yang mengisi.
    assert.deepEqual(h.komponen.map((k) => k.bobot), [40, 25, 35]);
    assert.deepEqual(h.baris.map((b) => b.bobot), [20, 20, 25, 35]);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
  });

  it("membuang komponen yang tidak dirinci baris mana pun", () => {
    const h = alokasikanAsesmen(
      masukan({
        komponen: [
          { nama: "Tugas", bobot: 40 },
          { nama: "UTS", bobot: 25 },
          { nama: "UAS", bobot: 25 },
          { nama: "Partisipasi", bobot: 10 },
        ],
      }),
    );
    assert.deepEqual(h.komponen.map((k) => k.nama), ["Tugas", "UTS", "UAS"]);
    assert.equal(jumlah(h.komponen.map((k) => k.bobot)), 100);
    assert.ok(h.catatan.some((c) => c.includes("Partisipasi")));
  });

  it("menurunkan buku besar dari baris bila angka komponennya ngawur", () => {
    const h = alokasikanAsesmen(
      masukan({
        komponen: [
          { nama: "Tugas", bobot: 4 },
          { nama: "UTS", bobot: 2 },
          { nama: "UAS", bobot: 3 },
        ],
      }),
    );
    assert.equal(jumlah(h.komponen.map((k) => k.bobot)), 100);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
    assert.ok(h.catatan.some((c) => c.includes("diturunkan dari jumlah baris")));
  });
});

describe("alokasikanAsesmen — baris yang lupa menyebut komponen", () => {
  it("memasang baris ujian ke komponen ujiannya, meski namanya panjang", () => {
    const h = alokasikanAsesmen(
      masukan({
        komponen: [
          { nama: "Tugas", bobot: 40 },
          { nama: "Ujian Tengah Semester", bobot: 25 },
          { nama: "Ujian Akhir Semester", bobot: 35 },
        ],
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
          { minggu: 2, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
          { minggu: 3, jenis: "UTS", bobot: 25, komponen: null },
          { minggu: 6, jenis: "UAS", bobot: 35, komponen: null },
        ],
      }),
    );
    assert.equal(h.baris[2].komponen, "Ujian Tengah Semester");
    assert.equal(h.baris[3].komponen, "Ujian Akhir Semester");
    // Tidak ada komponen "UTS" kedua yang dibuat di samping yang sudah ada.
    assert.equal(h.komponen.length, 3);
  });

  it("memasang baris efektif ke komponen bukan-ujian yang terbesar", () => {
    const h = alokasikanAsesmen(
      masukan({
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 20, komponen: null },
          { minggu: 2, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
          { minggu: 3, jenis: "UTS", bobot: 25, komponen: "UTS" },
          { minggu: 6, jenis: "UAS", bobot: 35, komponen: "UAS" },
        ],
      }),
    );
    assert.equal(h.baris[0].komponen, "Tugas");
    assert.ok(h.catatan.some((c) => c.includes("minggu 1")));
  });

  it("membentuk komponen sendiri bila tidak ada satu pun yang bukan ujian", () => {
    const h = alokasikanAsesmen(
      masukan({
        komponen: [
          { nama: "UTS", bobot: 50 },
          { nama: "UAS", bobot: 50 },
        ],
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 20, komponen: null },
          { minggu: 3, jenis: "UTS", bobot: 40, komponen: "UTS" },
          { minggu: 6, jenis: "UAS", bobot: 40, komponen: "UAS" },
        ],
        tugas: [],
      }),
    );
    assert.ok(h.komponen.some((k) => k.nama === "Penilaian Proses"));
    assert.equal(jumlah(h.komponen.map((k) => k.bobot)), 100);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
  });
});

describe("alokasikanAsesmen — bobot yang tidak dapat mengalir dilepas", () => {
  it("melepas bobot minggu yang tidak menjadwalkan Sub-CPMK", () => {
    const h = alokasikanAsesmen(
      masukan({
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
          // Minggu 2 ada pada mingguBerSubCpmk; minggu 5 juga. Minggu 4 tidak
          // dijadwalkan Sub-CPMK apa pun pada kasus ini.
          { minggu: 4, jenis: "EFEKTIF", bobot: 20, komponen: "Tugas" },
          { minggu: 3, jenis: "UTS", bobot: 25, komponen: "UTS" },
          { minggu: 6, jenis: "UAS", bobot: 35, komponen: "UAS" },
        ],
        mingguBerSubCpmk: [1, 2, 5],
      }),
    );
    assert.equal(h.baris[1].bobot, 0);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
    assert.ok(h.catatan.some((c) => c.includes("minggu 4")));
  });

  it("melepas bobot ujian yang kisi-kisinya tidak disusun", () => {
    const h = alokasikanAsesmen(masukan({ kisiKisiBerisi: ["UTS"] }));
    const uas = h.baris.find((b) => b.jenis === "UAS");
    assert.equal(uas?.bobot, 0);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
    assert.ok(!h.komponen.some((k) => k.nama === "UAS"));
    assert.ok(h.catatan.some((c) => c.includes("kisi-kisi UAS")));
  });

  it("tidak meledak bila seluruh bobot ternyata tidak sah", () => {
    const h = alokasikanAsesmen(
      masukan({ kisiKisiBerisi: [], mingguBerSubCpmk: [] }),
    );
    assert.deepEqual(h.komponen, []);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 0);
    assert.equal(h.tugas[0].bobot, 0);
  });
});

describe("alokasikanAsesmen — lembar tugas adalah rencana, bukan bobot kedua", () => {
  it("menyelaraskan bobot tugas dengan komponennya, tidak menambahkannya", () => {
    const h = alokasikanAsesmen(
      masukan({
        tugas: [
          { nomor: 1, mingguMulai: 1, mingguSelesai: 1, bobot: 30, komponen: "Tugas" },
          { nomor: 2, mingguMulai: 2, mingguSelesai: 2, bobot: 30, komponen: "Tugas" },
        ],
      }),
    );
    // Dua tugas 30 + 30 pada komponen berbobot 40 → 20 + 20, bukan 60.
    assert.deepEqual(h.tugas.map((t) => t.bobot), [20, 20]);
  });

  it("memasang tugas tanpa komponen ke baris berbobot pada minggu selesainya", () => {
    const h = alokasikanAsesmen(
      masukan({
        tugas: [
          { nomor: 1, mingguMulai: 1, mingguSelesai: 2, bobot: 40, komponen: null },
        ],
      }),
    );
    assert.equal(h.tugas[0].komponen, "Tugas");
    assert.equal(h.tugas[0].bobot, 40);
  });

  it("melepas bobot tugas yang tidak punya baris berbobot mana pun", () => {
    const h = alokasikanAsesmen(
      masukan({
        tugas: [
          { nomor: 1, mingguMulai: 4, mingguSelesai: 5, bobot: 40, komponen: "Proyek" },
        ],
      }),
    );
    assert.equal(h.tugas[0].bobot, 0);
    assert.equal(jumlah(h.baris.map((b) => b.bobot)), 100);
  });
});

/**
 * Uji silang yang paling berharga di berkas ini.
 *
 * `alokasikanAsesmen` dan `susunPetaAsesmen` selama ini hanya bertetangga:
 * yang satu menyusun angka, yang lain memeriksanya, dan tidak ada apa pun yang
 * mengikat keduanya. Uji ini yang mengikatnya — masukan seburuk apa pun yang
 * masih punya satu bobot sah harus keluar sebagai peta yang `lolos`.
 */
function kePeta(h: ReturnType<typeof alokasikanAsesmen>): SumberPeta {
  const subPerMinggu: Record<number, string[]> = {
    1: ["S1"], 2: ["S2"], 4: ["S3"], 5: ["S4"],
  };
  return {
    komponenNilai: h.komponen,
    pertemuan: h.baris.map((b) => ({
      minggu: b.minggu,
      jenis: b.jenis,
      penilaianJenis: null,
      bobot: b.bobot,
      komponen: b.komponen,
      subCpmkKode: subPerMinggu[b.minggu] ?? [],
    })),
    tugas: h.tugas.map((t) => ({
      nomor: t.nomor,
      nama: `Tugas ${t.nomor}`,
      bobot: t.bobot,
      komponen: t.komponen,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      subCpmkKode: ["S1"],
    })),
    kisiKisi: [
      { jenis: "UTS", butir: [{ subCpmkKode: "S1", skor: 50 }, { subCpmkKode: "S2", skor: 50 }] },
      { jenis: "UAS", butir: [{ subCpmkKode: "S3", skor: 50 }, { subCpmkKode: "S4", skor: 50 }] },
    ],
    cpmk: [{ kode: "CPMK1", subCpmkKode: ["S1", "S2", "S3", "S4"], cplKode: ["CPL1"] }],
    cplDibebankan: ["CPL1"],
  };
}

describe("alokasikanAsesmen — petanya tertutup menurut konstruksi", () => {
  it("draf yang rapi menghasilkan peta yang lolos", () => {
    const peta = susunPetaAsesmen(kePeta(alokasikanAsesmen(masukan())));
    assert.deepEqual(peta.pemblokir, []);
    assert.equal(peta.lolos, true);
    assert.equal(peta.ringkasan.totalBobot, 100);
    assert.equal(peta.ringkasan.subCpmkTerukur, 4);
  });

  it("draf yang berantakan pun menghasilkan peta yang lolos", () => {
    // Semua kelalaian docs/12 §1 sekaligus: baris tanpa komponen, komponen
    // yatim, bobot yang tidak berjumlah 100, dan tugas yang menduplikasi bobot.
    const h = alokasikanAsesmen(
      masukan({
        komponen: [
          { nama: "Tugas", bobot: 30 },
          { nama: "UTS", bobot: 30 },
          { nama: "UAS", bobot: 30 },
          { nama: "Kehadiran", bobot: 20 },
        ],
        baris: [
          { minggu: 1, jenis: "EFEKTIF", bobot: 25, komponen: null },
          { minggu: 2, jenis: "EFEKTIF", bobot: 25, komponen: "Tugas" },
          { minggu: 3, jenis: "UTS", bobot: 30, komponen: null },
          { minggu: 6, jenis: "UAS", bobot: 30, komponen: "UAS" },
        ],
        tugas: [
          { nomor: 1, mingguMulai: 1, mingguSelesai: 2, bobot: 55, komponen: "Tugas" },
          { nomor: 2, mingguMulai: 4, mingguSelesai: 5, bobot: 20, komponen: "Kehadiran" },
        ],
      }),
    );
    const peta = susunPetaAsesmen(kePeta(h));
    assert.deepEqual(peta.pemblokir, []);
    assert.equal(peta.lolos, true);
    assert.equal(peta.ringkasan.totalBobot, 100);
    assert.ok(h.catatan.length > 0);
  });
});
