import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  denyutHarian,
  kelengkapanRpkps,
  persen,
  sebaranStatus,
  tahapKelas,
  type SumberKelengkapan,
  type SumberTahapKelas,
} from "./ringkasan";

const DEFINISI = [
  { kunci: "DRAF", label: "Draf", nada: "netral" as const },
  { kunci: "TERBIT", label: "Terbit", nada: "sukses" as const },
];

describe("sebaran status", () => {
  it("mempertahankan segmen bernilai nol supaya corong tetap terbaca", () => {
    const s = sebaranStatus(["DRAF", "DRAF"], DEFINISI);
    assert.deepEqual(
      s.map((x) => [x.kunci, x.jumlah]),
      [
        ["DRAF", 2],
        ["TERBIT", 0],
      ],
    );
  });

  it("mengabaikan status yang tidak terdaftar, bukan menambahkannya diam-diam", () => {
    const s = sebaranStatus(["DRAF", "ARSIP"], DEFINISI);
    assert.equal(s.length, 2);
    assert.equal(s.reduce((t, x) => t + x.jumlah, 0), 1);
  });
});

describe("persen", () => {
  it("memberi nol untuk pembagi nol, bukan NaN", () => {
    assert.equal(persen(3, 0), 0);
  });

  it("membulatkan ke satu desimal", () => {
    assert.equal(persen(1, 3), 33.3);
  });
});

function kelas(ubah: Partial<SumberTahapKelas> = {}): SumberTahapKelas {
  return {
    jumlahPeserta: 20,
    jumlahAsesmen: 5,
    nilaiTerisi: 100,
    statusEvaluasi: "DRAF",
    ...ubah,
  };
}

describe("tahap kelas", () => {
  it("menandai kelas tanpa peserta lebih dulu daripada nilai kosong", () => {
    const h = tahapKelas(kelas({ jumlahPeserta: 0, nilaiTerisi: 0 }));
    assert.equal(h.tahap, "TANPA_PESERTA");
    assert.equal(h.nada, "bahaya");
  });

  it("menandai peta asesmen kosong — bobot belum dirinci sama sekali", () => {
    const h = tahapKelas(kelas({ jumlahAsesmen: 0, nilaiTerisi: 0 }));
    assert.equal(h.tahap, "TANPA_ASESMEN");
  });

  it("evaluasi yang sudah ditutup selalu menang atas kelengkapan nilai", () => {
    // Angka evaluasi dibekukan saat ditutup; baris nilai boleh saja berubah
    // sesudahnya tanpa membuat kelas ini kembali "belum selesai".
    const h = tahapKelas(kelas({ nilaiTerisi: 0, statusEvaluasi: "DITUTUP" }));
    assert.equal(h.tahap, "DITUTUP");
    assert.equal(h.persenNilai, 100);
  });

  it("membedakan nilai kosong dari nilai sebagian", () => {
    assert.equal(tahapKelas(kelas({ nilaiTerisi: 0 })).tahap, "TANPA_NILAI");
    assert.equal(tahapKelas(kelas({ nilaiTerisi: 40 })).tahap, "NILAI_SEBAGIAN");
  });

  it("menyatakan siap dihitung hanya bila seluruh sel terisi", () => {
    assert.equal(tahapKelas(kelas({ nilaiTerisi: 99 })).tahap, "NILAI_SEBAGIAN");
    assert.equal(tahapKelas(kelas({ nilaiTerisi: 100 })).tahap, "SIAP_HITUNG");
  });

  it("tidak pernah melewati 100% meski baris nilai berlebih", () => {
    const h = tahapKelas(kelas({ nilaiTerisi: 500 }));
    assert.equal(h.persenNilai, 100);
  });

  it("urutan tahap menaruh yang paling perlu ditengok di depan", () => {
    const daftar = [
      tahapKelas(kelas({ statusEvaluasi: "DITUTUP" })),
      tahapKelas(kelas({ jumlahPeserta: 0 })),
      tahapKelas(kelas({ nilaiTerisi: 40 })),
    ].sort((a, b) => a.urutan - b.urutan);
    assert.deepEqual(
      daftar.map((d) => d.tahap),
      ["TANPA_PESERTA", "NILAI_SEBAGIAN", "DITUTUP"],
    );
  });
});

function lengkap(ubah: Partial<SumberKelengkapan> = {}): SumberKelengkapan {
  return {
    pertemuanTotal: 16,
    pertemuanBerisi: 16,
    totalBobot: 100,
    subCpmkTotal: 8,
    subCpmkTerjadwal: 8,
    adaPustaka: true,
    adaTugas: true,
    ...ubah,
  };
}

describe("kelengkapan RPKPS", () => {
  it("memberi 100% hanya bila kelima butir terpenuhi", () => {
    const h = kelengkapanRpkps(lengkap());
    assert.equal(h.persen, 100);
    assert.deepEqual(h.kurang, []);
  });

  it("menyebutkan apa yang kurang, bukan sekadar angka", () => {
    const h = kelengkapanRpkps(lengkap({ pertemuanBerisi: 12, totalBobot: 80 }));
    assert.equal(h.persen, 60);
    assert.deepEqual(h.kurang, [
      "4 pertemuan belum bertopik",
      "bobot penilaian 80%, belum 100%",
    ]);
  });

  it("membedakan kerangka yang belum dibuat dari kerangka yang belum diisi", () => {
    const h = kelengkapanRpkps(lengkap({ pertemuanTotal: 0, pertemuanBerisi: 0 }));
    assert.ok(h.kurang.includes("kerangka pertemuan belum dibuat"));
  });

  it("bobot 100 dengan galat pembulatan kecil tetap dianggap sah", () => {
    const h = kelengkapanRpkps(lengkap({ totalBobot: 99.995 }));
    assert.equal(h.persen, 100);
  });

  it("mata kuliah tanpa Sub-CPMK tidak dihitung terjadwal", () => {
    const h = kelengkapanRpkps(lengkap({ subCpmkTotal: 0, subCpmkTerjadwal: 0 }));
    assert.ok(h.kurang.includes("mata kuliah belum punya Sub-CPMK"));
  });
});

describe("denyut harian", () => {
  const sekarang = new Date(2026, 7, 24, 13, 30);

  it("mengembalikan tepat sebanyak hari yang diminta, berakhir hari ini", () => {
    const d = denyutHarian([], 7, sekarang);
    assert.equal(d.length, 7);
    assert.equal(d[6].tanggal, "2026-08-24");
    assert.equal(d[0].tanggal, "2026-08-18");
  });

  it("hari tanpa kejadian tetap muncul sebagai nol", () => {
    const d = denyutHarian([new Date(2026, 7, 24, 8)], 3, sekarang);
    assert.deepEqual(
      d.map((x) => x.jumlah),
      [0, 0, 1],
    );
  });

  it("mengabaikan kejadian di luar jendela", () => {
    const d = denyutHarian(
      [new Date(2026, 6, 1), new Date(2026, 7, 23), new Date(2026, 7, 23, 20)],
      3,
      sekarang,
    );
    assert.deepEqual(
      d.map((x) => x.jumlah),
      [0, 2, 0],
    );
  });
});
