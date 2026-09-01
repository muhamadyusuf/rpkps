import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KEBIJAKAN_BAWAAN } from "@/domain/beban-belajar/kebijakan-bawaan";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { rancangKerangkaMingguan } from "./kerangka";

const mk = {
  kode: "TI214",
  nama: "Pemrograman",
  sksTeori: 2,
  sksPraktik: 1,
  bentukTeori: "KULIAH" as const,
  bentukPraktik: "PRAKTIKUM" as const,
};

const rencana = susunRencanaSemester(KEBIJAKAN_BAWAAN, mk);

describe("kerangka mingguan", () => {
  it("menghasilkan satu baris per minggu semester", () => {
    const baris = rancangKerangkaMingguan(rencana, KEBIJAKAN_BAWAAN, []);
    assert.equal(baris.length, KEBIJAKAN_BAWAAN.mingguPerSemester);
    assert.deepEqual(
      baris.map((b) => b.minggu),
      rencana.minggu.map((m) => m.minggu),
    );
  });

  it("menandai minggu ujian, UTS di paruh pertama dan UAS di akhir", () => {
    const baris = rancangKerangkaMingguan(rencana, KEBIJAKAN_BAWAAN, []);
    const ujian = baris.filter((b) => b.jenis !== "EFEKTIF");
    assert.equal(ujian.at(0)?.jenis, "UTS");
    assert.equal(ujian.at(-1)?.jenis, "UAS");
    assert.equal(ujian.at(-1)?.minggu, KEBIJAKAN_BAWAAN.mingguPerSemester);
  });

  it("alokasi waktu tiap baris sama dengan pagu minggunya", () => {
    const baris = rancangKerangkaMingguan(rencana, KEBIJAKAN_BAWAAN, []);
    for (const b of baris) {
      const pagu = rencana.minggu.find((m) => m.minggu === b.minggu)!.pagu;
      const menit = b.aktivitas.reduce((s, a) => s + a.menit, 0);
      assert.equal(menit, pagu.total, `minggu ${b.minggu}`);
    }
  });

  it("Sub-CPMK dibagikan berurutan, satu per pertemuan efektif", () => {
    const baris = rancangKerangkaMingguan(rencana, KEBIJAKAN_BAWAAN, ["s1", "s2", "s3"]);
    const efektif = baris.filter((b) => b.jenis === "EFEKTIF");
    assert.deepEqual(
      efektif.slice(0, 4).map((b) => b.subCpmkId),
      ["s1", "s2", "s3", null],
    );
    // Baris ujian tidak pernah kebagian Sub-CPMK; porsinya dari kisi-kisi.
    assert.ok(baris.filter((b) => b.jenis !== "EFEKTIF").every((b) => b.subCpmkId === null));
  });

  it("Sub-CPMK yang melebihi jumlah pertemuan tidak dipaksakan masuk", () => {
    const banyak = Array.from({ length: 40 }, (_, i) => `s${i}`);
    const baris = rancangKerangkaMingguan(rencana, KEBIJAKAN_BAWAAN, banyak);
    const terpakai = baris.filter((b) => b.subCpmkId !== null).length;
    assert.equal(terpakai, baris.filter((b) => b.jenis === "EFEKTIF").length);
  });
});
