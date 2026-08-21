import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KEBIJAKAN_BAWAAN } from "@/domain/beban-belajar/kebijakan-bawaan";
import { paguPertemuanEfektif, susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { ekstrakMenitDariNarasi, validasiRpkps } from "./validator";
import type { AktivitasRpkps, PertemuanRpkps, RpkpsInput } from "./tipe";

const kebijakan = KEBIJAKAN_BAWAAN;

/** TI214 versi sehat: 2 sks teori + 1 praktik, seluruh aturan terpenuhi. */
function rpkpsSehat(): RpkpsInput {
  const mk = { sksTeori: 2, sksPraktik: 1, bentukTeori: "KULIAH" as const, bentukPraktik: "PRAKTIKUM" as const };
  const rencana = susunRencanaSemester(kebijakan, mk);
  const subCpmk = Array.from({ length: 14 }, (_, i) => `CPMK081-${i + 1}`);

  // 14 minggu efektif @ 5% + UTS 15% + UAS 15% = 100%
  const pertemuan: PertemuanRpkps[] = rencana.minggu.map((m) => {
    const ujian = m.jenis === "UJIAN";
    const indeksEfektif = rencana.minggu
      .filter((x) => x.jenis === "EFEKTIF")
      .findIndex((x) => x.minggu === m.minggu);

    return {
      minggu: m.minggu,
      jenis: ujian ? (m.minggu < 10 ? "UTS" : "UAS") : "EFEKTIF",
      topik: ujian ? "Ujian" : `Topik minggu ${m.minggu}`,
      subtopik: [],
      metodeNarasi: null,
      penilaianJenis: ujian ? "Tes tertulis" : "Tugas",
      bobot: ujian ? 15 : 5,
      subCpmkKode: ujian ? [] : [subCpmk[indeksEfektif]],
      aktivitas: (
        [
          { nama: "Tatap muka", kategori: "TM", menit: m.pagu.tm },
          { nama: "Penugasan terstruktur", kategori: "PT", menit: m.pagu.pt },
          { nama: "Belajar mandiri", kategori: "BM", menit: m.pagu.bm },
        ] satisfies AktivitasRpkps[]
      ).filter((a) => a.menit > 0),
      indikator: ujian ? ["Ketepatan jawaban"] : ["Indikator A", "Indikator B"],
      pustakaNomor: [1],
    };
  });

  return {
    mkKode: "TI214",
    mkNama: "Basis Data",
    sksTeori: 2,
    sksPraktik: 1,
    deskripsi:
      "Mata kuliah Basis Data memberikan pemahaman komprehensif mengenai konsep dasar, perancangan, dan implementasi sistem basis data relasional.",
    cplKode: ["CPL06", "CPL08"],
    subCpmkTersedia: subCpmk,
    pertemuan,
    komponenNilai: [
      { nama: "UTS", bobot: 15 },
      { nama: "UAS", bobot: 15 },
      { nama: "Tugas", bobot: 70 },
    ],
    tugas: [
      {
        nomor: 1,
        nama: "Proyek Akhir Basis Data",
        mingguMulai: 9,
        mingguSelesai: 16,
        bobot: 20,
        deskripsi:
          "Mahasiswa membangun purwarupa sistem basis data fungsional untuk menyelesaikan masalah nyata, dari analisis kebutuhan sampai integrasi aplikasi.",
        subCpmkKode: ["CPMK081-3", "CPMK081-4"],
        kriteria: [
          { nomor: 1, indikator: "Desain & pemodelan", bobot: 25 },
          { nomor: 2, indikator: "Implementasi SQL & integritas", bobot: 30 },
          { nomor: 3, indikator: "Integrasi & pengujian", bobot: 20 },
          { nomor: 4, indikator: "Presentasi & demo", bobot: 15 },
          { nomor: 5, indikator: "Refleksi individu", bobot: 10 },
        ],
        jumlahLinimasa: 5,
      },
    ],
    jumlahPustakaUtama: 2,
    jumlahPengampu: 1,
  };
}

describe("RPKPS sehat", () => {
  it("lolos seluruh pemeriksaan", () => {
    const h = validasiRpkps(rpkpsSehat(), kebijakan);
    assert.equal(
      h.lolos,
      true,
      `masih ada pemblokir: ${h.pemblokir.map((t) => `${t.kode}(${t.pesan})`).join(" | ")}`,
    );
    assert.equal(h.ringkasan.totalBobotMingguan, 100);
    assert.equal(h.ringkasan.totalBobotKomponen, 100);
    assert.equal(h.ringkasan.jumlahPertemuan, 16);
    assert.deepEqual(h.ringkasan.subCpmkBelumDijadwalkan, []);
  });
});

describe("B1 — total bobot mingguan (temuan nyata TI214: 120%)", () => {
  it("bobot berjumlah 120% adalah pemblokir", () => {
    const r = rpkpsSehat();
    // Persis kondisi dokumen asli: bobot mingguan berlebih 20%.
    r.pertemuan[0].bobot = 25;
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.find((x) => x.kode === "B1-BOBOT-MINGGUAN");
    assert.ok(t, "seharusnya menandai total bobot salah");
    assert.match(t!.pesan, /120%/);
  });
});

describe("B2 — rekonsiliasi bobot mingguan dan komponen nilai", () => {
  it("mingguan 100% tetapi komponen 90% ditandai", () => {
    const r = rpkpsSehat();
    r.komponenNilai = [
      { nama: "UTS", bobot: 15 },
      { nama: "UAS", bobot: 15 },
      { nama: "Tugas", bobot: 60 },
    ];
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.pemblokir.some((t) => t.kode === "B2-BOBOT-KOMPONEN"));
  });

  it("tanpa komponen nilai sama sekali adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.komponenNilai = [];
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.pemblokir.some((t) => t.kode === "B2-KOMPONEN-KOSONG"));
  });
});

describe("B3 — Sub-CPMK terjadwal", () => {
  it("Sub-CPMK yang tidak pernah dijadwalkan adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.pertemuan[3].subCpmkKode = [];
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.find((x) => x.kode === "B3-SUB-CPMK-TIDAK-DIJADWALKAN");
    assert.ok(t);
    assert.equal(h.ringkasan.subCpmkBelumDijadwalkan.length, 1);
  });

  it("merujuk Sub-CPMK milik mata kuliah lain adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.pertemuan[0].subCpmkKode = ["CPMK999-1"];
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.pemblokir.some((t) => t.kode === "B3-SUB-CPMK-ASING"));
  });
});

describe("B4 — narasi metode vs alokasi waktu (temuan nyata TI214)", () => {
  it("narasi 480 menit sedangkan aktivitas 510 menit adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.pertemuan[0].metodeNarasi =
      "Tatap muka (sinkron, 120 menit). Tidak tatap muka (asinkron, 360 menit).";
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.find((x) => x.kode === "B4-NARASI-BEDA");
    assert.ok(t, "seharusnya menandai kontradiksi narasi");
    assert.match(t!.pesan, /8 jam/);
  });

  it("narasi tanpa angka menit tidak dianggap bertentangan", () => {
    const r = rpkpsSehat();
    r.pertemuan[0].metodeNarasi = "Ceramah interaktif dan diskusi kelas.";
    const h = validasiRpkps(r, kebijakan);
    assert.ok(!h.pemblokir.some((t) => t.kode === "B4-NARASI-BEDA"));
  });

  it("ekstraksi menit menjumlahkan seluruh angka pada narasi", () => {
    assert.equal(
      ekstrakMenitDariNarasi("sinkron, 120 menit … asinkron, 360 menit"),
      480,
    );
    assert.equal(ekstrakMenitDariNarasi("tanpa angka"), null);
    assert.equal(ekstrakMenitDariNarasi(null), null);
  });
});

describe("B5 — minggu ujian wajib beralokasi waktu (temuan docs/03 §2.1)", () => {
  it("minggu ujian tanpa aktivitas adalah pemblokir", () => {
    const r = rpkpsSehat();
    for (const p of r.pertemuan) {
      if (p.jenis !== "EFEKTIF") p.aktivitas = [];
    }
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.filter((x) => x.kode === "B5-UJIAN-TANPA-ALOKASI");
    assert.equal(t.length, 2, "UTS dan UAS keduanya ditandai");
    assert.match(t[0].pesan, /beban belajar nyata/);
  });

  it("total semester meleset dari 45 jam/sks adalah pemblokir", () => {
    const r = rpkpsSehat();
    // Angka TI214 yang tertulis: 580 menit per minggu efektif.
    for (const p of r.pertemuan) {
      if (p.jenis === "EFEKTIF") {
        p.aktivitas = [
          { nama: "TM", kategori: "TM", menit: 120 },
          { nama: "PT", kategori: "PT", menit: 180 },
          { nama: "BM", kategori: "BM", menit: 280 },
        ];
      }
    }
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.pemblokir.some((t) => t.kode === "B5-SEMESTER"));
  });
});

describe("B6 — struktur 16 minggu lengkap", () => {
  it("minggu yang hilang ditandai", () => {
    const r = rpkpsSehat();
    r.pertemuan = r.pertemuan.filter((p) => p.minggu !== 8 && p.minggu !== 16);
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.find((x) => x.kode === "B6-MINGGU-HILANG");
    assert.ok(t);
    assert.match(t!.pesan, /8, 16/);
  });
});

describe("kelengkapan komponen wajib SN-Dikti", () => {
  it("deskripsi kosong adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.deskripsi = null;
    assert.ok(validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "B-DESKRIPSI"));
  });

  it("tanpa pustaka utama adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.jumlahPustakaUtama = 0;
    assert.ok(validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "B-TANPA-PUSTAKA"));
  });

  it("tanpa pengampu adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.jumlahPengampu = 0;
    assert.ok(validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "B-TANPA-PENGAMPU"));
  });
});

describe("bagian I — tugas / proyek", () => {
  it("bobot indikator tugas harus 100%", () => {
    const r = rpkpsSehat();
    r.tugas[0].kriteria[0].bobot = 40; // total jadi 115%
    const h = validasiRpkps(r, kebijakan);
    const t = h.pemblokir.find((x) => x.kode === "I-BOBOT-KRITERIA");
    assert.ok(t);
    assert.match(t!.pesan, /115%/);
  });

  it("tugas tanpa indikator adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.tugas[0].kriteria = [];
    assert.ok(
      validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "I-TANPA-KRITERIA"),
    );
  });

  it("merujuk Sub-CPMK milik mata kuliah lain adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.tugas[0].subCpmkKode = ["CPMK999-9"];
    assert.ok(
      validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "I-SUB-CPMK-ASING"),
    );
  });

  it("rentang minggu di luar semester adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.tugas[0].mingguSelesai = 20;
    assert.ok(
      validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "I-MINGGU-DILUAR"),
    );
  });

  it("minggu mulai melebihi minggu selesai adalah pemblokir", () => {
    const r = rpkpsSehat();
    r.tugas[0].mingguMulai = 14;
    r.tugas[0].mingguSelesai = 10;
    assert.ok(
      validasiRpkps(r, kebijakan).pemblokir.some((t) => t.kode === "I-MINGGU-TERBALIK"),
    );
  });

  it("tanpa linimasa hanya peringatan, tidak memblokir", () => {
    const r = rpkpsSehat();
    r.tugas[0].jumlahLinimasa = 0;
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.peringatan.some((t) => t.kode === "I-TANPA-LINIMASA"));
    assert.equal(h.lolos, true);
  });

  it("RPKPS tanpa tugas sama sekali tetap lolos", () => {
    const r = rpkpsSehat();
    r.tugas = [];
    assert.equal(validasiRpkps(r, kebijakan).lolos, true);
  });
});

describe("peringatan tingkat pertemuan", () => {
  it("pertemuan berbobot tanpa indikator diperingatkan", () => {
    const r = rpkpsSehat();
    r.pertemuan[0].indikator = [];
    const h = validasiRpkps(r, kebijakan);
    assert.ok(h.peringatan.some((t) => t.kode === "W-TANPA-INDIKATOR"));
    assert.equal(h.lolos, true, "peringatan tidak boleh memblokir");
  });

  it("pertemuan tanpa topik diperingatkan", () => {
    const r = rpkpsSehat();
    r.pertemuan[2].topik = null;
    assert.ok(
      validasiRpkps(r, kebijakan).peringatan.some((t) => t.kode === "W-TANPA-TOPIK"),
    );
  });
});

describe("pagu dipakai konsisten dengan mesin beban belajar", () => {
  it("pagu minggu efektif 2T+1P adalah 510 menit dengan 200 menit terjadwal", () => {
    const p = paguPertemuanEfektif(kebijakan, {
      sksTeori: 2,
      sksPraktik: 1,
      bentukTeori: "KULIAH",
      bentukPraktik: "PRAKTIKUM",
    });
    assert.equal(p.total, 510);
    assert.equal(p.terjadwal, 200);
  });
});
