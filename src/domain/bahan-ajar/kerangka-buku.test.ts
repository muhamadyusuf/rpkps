import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nomoriUlang, rancangKerangkaBuku } from "./kerangka-buku";
import { sidikSumberBab } from "./sidik-sumber";
import type { PertemuanUntukBab } from "./tipe";

function minggu(
  n: number,
  ubah: Partial<PertemuanUntukBab> = {},
): PertemuanUntukBab {
  return {
    id: `p${n}`,
    minggu: n,
    jenis: "EFEKTIF",
    topik: `Topik minggu ${n}`,
    subtopik: [`Subtopik ${n}a`, `Subtopik ${n}b`],
    indikator: [`Mahasiswa mampu menjelaskan pokok ${n}`],
    subCpmk: [{ kode: `SUB-CPMK${n}`, rumusan: `Mampu menerapkan konsep ${n}` }],
    nomorPustaka: [1],
    ...ubah,
  };
}

describe("kerangka buku ajar", () => {
  it("satu bab per minggu efektif, ujian tidak menjadi bab", () => {
    const { bab } = rancangKerangkaBuku([
      minggu(1),
      minggu(2),
      minggu(8, { jenis: "UTS", topik: "Ujian Tengah Semester" }),
      minggu(9),
      minggu(16, { jenis: "UAS", topik: "Ujian Akhir Semester" }),
    ]);

    assert.deepEqual(
      bab.map((b) => b.minggu),
      [1, 2, 9],
    );
  });

  it("nomor bab berurutan, bukan nomor minggunya", () => {
    // Buku yang babnya melompat dari 2 ke 4 karena minggu 3 adalah UTS
    // terbaca seperti buku yang kehilangan satu bab.
    const { bab } = rancangKerangkaBuku([
      minggu(1),
      minggu(2),
      minggu(3, { jenis: "UTS" }),
      minggu(4),
    ]);
    assert.deepEqual(
      bab.map((b) => b.nomor),
      [1, 2, 3],
    );
    assert.equal(bab.at(-1)?.minggu, 4);
  });

  it("baris mingguan yang tidak berurutan tetap tersusun menurut minggunya", () => {
    const { bab } = rancangKerangkaBuku([minggu(3), minggu(1), minggu(2)]);
    assert.deepEqual(
      bab.map((b) => b.minggu),
      [1, 2, 3],
    );
  });

  it("judul bab diambil dari topik minggunya", () => {
    const { bab } = rancangKerangkaBuku([minggu(1, { topik: "  Pohon biner  " })]);
    assert.equal(bab[0].judul, "Pohon biner");
  });

  it("topik kosong memakai rumusan Sub-CPMK sebagai judul sementara", () => {
    const { bab } = rancangKerangkaBuku([
      minggu(1, {
        topik: null,
        subCpmk: [{ kode: "SUB-CPMK1", rumusan: "Mampu menyusun algoritma pengurutan" }],
      }),
    ]);
    assert.equal(bab[0].judul, "Mampu menyusun algoritma pengurutan");
  });

  it("rumusan Sub-CPMK yang panjang dipotong di batas kata", () => {
    const panjang =
      "Mampu merancang dan mengevaluasi arsitektur perangkat lunak berskala besar " +
      "dengan mempertimbangkan keterawatan serta kebutuhan nonfungsional lainnya";
    const { bab } = rancangKerangkaBuku([
      minggu(1, { topik: "", subCpmk: [{ kode: "S1", rumusan: panjang }] }),
    ]);
    assert.ok(bab[0].judul.length <= 81, bab[0].judul);
    assert.ok(bab[0].judul.endsWith("…"));
    assert.ok(!bab[0].judul.includes("  "));
  });

  it("minggu tanpa topik dan tanpa Sub-CPMK dilewati, dan dilaporkan", () => {
    // Dilaporkan, bukan dibuang diam-diam: yang belum selesai adalah RPKPS-nya,
    // dan dosen harus tahu itu sebelum menyalahkan AI.
    const { bab, dilewati } = rancangKerangkaBuku([
      minggu(1),
      minggu(2, { topik: null, subCpmk: [], indikator: [] }),
      minggu(3),
    ]);
    assert.deepEqual(dilewati, [2]);
    assert.deepEqual(
      bab.map((b) => b.nomor),
      [1, 2],
    );
    assert.deepEqual(
      bab.map((b) => b.minggu),
      [1, 3],
    );
  });

  it("tujuan bab memakai indikator; Sub-CPMK hanya bila indikatornya kosong", () => {
    const dariIndikator = rancangKerangkaBuku([
      minggu(1, { indikator: ["Menjelaskan A", "Menerapkan B"] }),
    ]).bab[0];
    assert.deepEqual(dariIndikator.tujuan, ["Menjelaskan A", "Menerapkan B"]);

    const dariSubCpmk = rancangKerangkaBuku([
      minggu(1, {
        indikator: ["   "],
        subCpmk: [{ kode: "S1", rumusan: "Mampu menghitung kompleksitas" }],
      }),
    ]).bab[0];
    assert.deepEqual(dariSubCpmk.tujuan, ["Mampu menghitung kompleksitas"]);
  });

  it("tiap bab membawa sidik rencana minggunya", () => {
    const p = minggu(1);
    const { bab } = rancangKerangkaBuku([p]);
    assert.equal(bab[0].sidikSumber, sidikSumberBab(p));
  });
});

describe("penomoran ulang", () => {
  it("merapatkan nomor yang berlubang tanpa mengubah urutannya", () => {
    const hasil = nomoriUlang([
      { nomor: 5, judul: "c" },
      { nomor: 1, judul: "a" },
      { nomor: 3, judul: "b" },
    ]);
    assert.deepEqual(hasil, [
      { nomor: 1, judul: "a" },
      { nomor: 2, judul: "b" },
      { nomor: 3, judul: "c" },
    ]);
  });
});
