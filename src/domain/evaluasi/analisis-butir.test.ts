import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analisisButir, type ButirUjian, type JawabanPeserta } from "./analisis-butir";
import { pesanTemuanId } from "@/lib/bahasa/temuan";

const BUTIR: ButirUjian[] = [
  { nomor: 1, subCpmkKode: "S1", levelBloom: "C2", skorMaks: 10 },
  { nomor: 2, subCpmkKode: "S1", levelBloom: "C3", skorMaks: 10 },
  { nomor: 3, subCpmkKode: "S2", levelBloom: "C4", skorMaks: 10 },
];

/** 20 peserta dengan penguasaan bertingkat: butir 1 mudah, 3 sukar. */
function kelasNormal(): JawabanPeserta[] {
  return Array.from({ length: 20 }, (_, i) => {
    const mampu = i / 19; // 0 sampai 1
    return {
      nim: `M${String(i).padStart(2, "0")}`,
      skor: {
        1: Math.round(6 + mampu * 4),
        2: Math.round(2 + mampu * 7),
        3: Math.round(mampu * 5),
      },
    };
  });
}

function kode(h: { temuan: { kode: string }[] }): string[] {
  return h.temuan.map((t) => t.kode);
}

describe("tingkat kesukaran", () => {
  it("menghitung P sebagai rerata dibagi skor maksimum", () => {
    const h = analisisButir(
      [BUTIR[0]],
      [
        { nim: "1", skor: { 1: 10 } },
        { nim: "2", skor: { 1: 6 } },
      ],
    );
    assert.equal(h.butir[0].rerata, 8);
    assert.equal(h.butir[0].kesukaran, 0.8);
    assert.equal(h.butir[0].kategoriKesukaran, "MUDAH");
  });

  it("menggolongkan sukar, sedang, dan mudah", () => {
    const h = analisisButir(BUTIR, kelasNormal());
    assert.equal(h.butir[0].kategoriKesukaran, "MUDAH");
    assert.equal(h.butir[1].kategoriKesukaran, "SEDANG");
    assert.equal(h.butir[2].kategoriKesukaran, "SUKAR");
    assert.ok(kode(h).includes("BS-BUTIR-SUKAR"));
  });
});

describe("daya beda", () => {
  it("memberi daya beda tinggi pada butir yang memisahkan atas dan bawah", () => {
    const h = analisisButir(BUTIR, kelasNormal());
    // Butir 2 naik paling tajam mengikuti penguasaan.
    assert.ok(h.butir[1].dayaBeda > 0.5, String(h.butir[1].dayaBeda));
    assert.equal(h.butir[1].kategoriDayaBeda, "SANGAT BAIK");
  });

  it("menandai daya beda negatif dengan tegas, tanpa menyandera penutupan", () => {
    // Butir 3 dibalik: separuh yang paling menguasai justru mendapat lebih
    // rendah. Selisihnya dijaga kecil agar peringkat total tetap ditentukan
    // butir 1 dan 2 — persis keadaan nyata sebuah butir yang kuncinya keliru.
    const peserta = kelasNormal().map((p, i) => ({
      ...p,
      skor: { ...p.skor, 3: i < 10 ? 6 : 2 },
    }));
    const h = analisisButir(BUTIR, peserta);
    assert.ok(h.butir[2].dayaBeda < 0, String(h.butir[2].dayaBeda));
    assert.equal(h.butir[2].kategoriDayaBeda, "BURUK");
    const t = h.temuan.find((x) => x.kode === "BS-DAYA-BEDA-NEGATIF")!;
    assert.equal(t.tingkat, "PERINGATAN");
    assert.ok(pesanTemuanId(t).includes("Butir 3"));
    assert.deepEqual(h.ringkasan.butirBermasalah, [3]);
  });

  it("menandai butir yang hampir tidak membedakan", () => {
    const peserta = kelasNormal().map((p) => ({ ...p, skor: { ...p.skor, 3: 5 } }));
    const h = analisisButir(BUTIR, peserta);
    assert.equal(h.butir[2].dayaBeda, 0);
    assert.equal(h.butir[2].kategoriDayaBeda, "JELEK");
    assert.ok(kode(h).includes("BS-DAYA-BEDA-RENDAH"));
  });

  it("memakai 27% teratas dan terbawah", () => {
    const h = analisisButir(BUTIR, kelasNormal());
    assert.equal(h.ringkasan.ukuranKelompok, 5); // round(20 × 0,27)
  });
});

describe("reliabilitas", () => {
  it("menghitung Cronbach alpha", () => {
    const h = analisisButir(BUTIR, kelasNormal());
    assert.ok(h.reliabilitas !== null);
    assert.ok(h.reliabilitas! > 0.7, String(h.reliabilitas));
  });

  it("memperingatkan reliabilitas rendah", () => {
    // Skor acak-acakan: butir tidak mengukur hal yang sama.
    const peserta: JawabanPeserta[] = Array.from({ length: 20 }, (_, i) => ({
      nim: `M${i}`,
      skor: { 1: (i * 7) % 11, 2: (i * 3) % 11, 3: (i * 5) % 11 },
    }));
    const h = analisisButir(BUTIR, peserta);
    assert.ok(h.reliabilitas! < 0.7, String(h.reliabilitas));
    assert.ok(kode(h).includes("BS-RELIABILITAS-RENDAH"));
  });

  it("tidak memaksakan alpha ketika butirnya cuma satu", () => {
    const h = analisisButir([BUTIR[0]], kelasNormal());
    assert.equal(h.reliabilitas, null);
  });
});

describe("data yang tidak memadai", () => {
  it("diam tanpa skor per butir — analisis ini opsional", () => {
    const h = analisisButir(BUTIR, []);
    assert.ok(kode(h).includes("BS-TANPA-DATA"));
    assert.equal(h.ringkasan.jumlahPeserta, 0);
  });

  it("tidak pernah memblokir apa pun — mutu soal urusan perbaikan, bukan gerbang", () => {
    const peserta = kelasNormal().map((p, i) => ({ ...p, skor: { ...p.skor, 3: i < 10 ? 6 : 2 } }));
    const h = analisisButir(BUTIR, peserta);
    assert.ok(h.temuan.every((t) => t.tingkat !== "PEMBLOKIR"));
  });

  it("memperingatkan kelas terlalu kecil", () => {
    const h = analisisButir(BUTIR, kelasNormal().slice(0, 6));
    assert.ok(kode(h).includes("BS-PESERTA-SEDIKIT"));
  });

  it("mengeluarkan peserta yang skornya tidak lengkap", () => {
    const peserta = [...kelasNormal(), { nim: "X", skor: { 1: 8, 2: null, 3: 4 } }];
    const h = analisisButir(BUTIR, peserta);
    assert.equal(h.ringkasan.jumlahPeserta, 20);
    assert.ok(kode(h).includes("BS-SKOR-TIDAK-LENGKAP"));
  });
});
