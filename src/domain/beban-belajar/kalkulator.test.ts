import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KEBIJAKAN_BAWAAN } from "./kebijakan-bawaan";
import {
  formatMenit,
  paguPertemuanEfektif,
  posisiMingguUjian,
  susunRencanaSemester,
} from "./kalkulator";
import {
  bebanMahasiswa,
  periksaMataKuliah,
  validasiKonsistensiNarasi,
  validasiPertemuan,
} from "./validator";
import type { Kebijakan, SpesifikasiMataKuliah } from "./tipe";

const kebijakan = KEBIJAKAN_BAWAAN;

const TEORI_3SKS: SpesifikasiMataKuliah = {
  kode: "X-3T",
  sksTeori: 3,
  sksPraktik: 0,
  bentukTeori: "KULIAH",
  bentukPraktik: "PRAKTIKUM",
};

// TI214 Basis Data bila dideklarasikan ulang sesuai docs/03 §5.
const TI214: SpesifikasiMataKuliah = {
  kode: "TI214",
  nama: "Basis Data",
  sksTeori: 2,
  sksPraktik: 1,
  bentukTeori: "KULIAH",
  bentukPraktik: "PRAKTIKUM",
};

describe("pagu per minggu", () => {
  it("kuliah 3 sks = 510 menit (150 TM + 180 PT + 180 BM)", () => {
    const p = paguPertemuanEfektif(kebijakan, TEORI_3SKS);
    assert.equal(p.tm, 150);
    assert.equal(p.pt, 180);
    assert.equal(p.bm, 180);
    assert.equal(p.total, 510);
    assert.equal(p.terjadwal, 150);
    assert.equal(p.ruangKhusus, 0);
  });

  it("2 sks teori + 1 sks praktik juga 510 menit — total tidak berubah", () => {
    const p = paguPertemuanEfektif(kebijakan, TI214);
    assert.equal(p.total, 510, "invarian total per minggu harus sama");
  });

  it("tetapi beban TERJADWAL naik dari 150 ke 200 menit (docs/03 §2.2)", () => {
    const murni = paguPertemuanEfektif(kebijakan, TEORI_3SKS);
    const campuran = paguPertemuanEfektif(kebijakan, TI214);
    assert.equal(murni.terjadwal, 150);
    assert.equal(campuran.terjadwal, 200); // 100 kelas + 100 lab
    assert.equal(campuran.ruangKhusus, 100); // hanya lab
    assert.ok(campuran.terjadwal > murni.terjadwal);
  });
});

describe("posisi minggu ujian", () => {
  it("16 minggu dengan 14 pertemuan efektif -> UTS minggu 8, UAS minggu 16", () => {
    assert.deepEqual(posisiMingguUjian(kebijakan), [8, 16]);
  });

  it("tanpa selisih minggu, tidak ada minggu ujian", () => {
    const k: Kebijakan = { ...kebijakan, pertemuanEfektifTeori: 16 };
    assert.deepEqual(posisiMingguUjian(k), []);
  });
});

describe("invarian 45 jam per sks", () => {
  it("kuliah 3 sks mendarat tepat 45,0 jam/sks", () => {
    const r = susunRencanaSemester(kebijakan, TEORI_3SKS);
    assert.equal(r.targetMenit, 8100); // 45 x 60 x 3
    assert.equal(r.totalMenit, 8100);
    assert.equal(r.jamPerSks, 45);
    assert.equal(r.selisihMenit, 0);
  });

  it("minggu ujian menyerap sisa: 14 x 510 = 7.140, sisa 960 dibagi dua", () => {
    const r = susunRencanaSemester(kebijakan, TEORI_3SKS);
    const efektif = r.minggu.filter((m) => m.jenis === "EFEKTIF");
    const ujian = r.minggu.filter((m) => m.jenis === "UJIAN");

    assert.equal(efektif.length, 14);
    assert.equal(efektif.reduce((s, m) => s + m.pagu.total, 0), 7140);
    assert.equal(ujian.length, 2);
    for (const m of ujian) {
      assert.equal(m.pagu.total, 480);
      assert.equal(m.pagu.tm, 120, "pelaksanaan ujian");
      assert.equal(m.pagu.bm, 360, "persiapan ujian sebagai belajar mandiri");
    }
  });

  it("berlaku untuk 1 sampai 6 sks, teori maupun campuran", () => {
    for (let sks = 1; sks <= 6; sks += 1) {
      for (let p = 0; p <= sks; p += 1) {
        const r = susunRencanaSemester(kebijakan, {
          sksTeori: sks - p,
          sksPraktik: p,
          bentukTeori: "KULIAH",
          bentukPraktik: "PRAKTIKUM",
        });
        assert.equal(
          r.totalMenit,
          r.targetMenit,
          `sks=${sks} praktik=${p} tidak mendarat di target`,
        );
        assert.equal(r.jamPerSks, 45, `sks=${sks} praktik=${p}`);
      }
    }
  });

  it("praktikum 12 pertemuan tetap mendarat tepat di target", () => {
    const k: Kebijakan = { ...kebijakan, pertemuanEfektifPraktik: 12 };
    const r = susunRencanaSemester(k, TI214);
    const berpraktik = r.minggu.filter((m) => m.adaPraktik);
    assert.equal(berpraktik.length, 12);
    assert.equal(r.totalMenit, r.targetMenit);
    assert.equal(r.jamPerSks, 45);
  });
});

describe("minggu ujian tidak dihitung — kasus docs/03 §2.1", () => {
  const k: Kebijakan = { ...kebijakan, hitungMingguUjian: false };

  it("hanya 14 pertemuan menghasilkan 39,67 jam/sks, bukan 45", () => {
    const r = susunRencanaSemester(k, TEORI_3SKS);
    assert.equal(r.totalMenit, 7140);
    assert.equal(r.jamPerSks, 39.67);
    assert.equal(r.selisihMenit, -960, "kurang 16 jam untuk satu mata kuliah");
  });

  it("dua temuan pemblokir sekaligus", () => {
    const hasil = periksaMataKuliah(k, TEORI_3SKS);
    assert.equal(hasil.lolos, false);
    const kode = hasil.pemblokir.map((t) => t.kode).sort();
    assert.deepEqual(kode, ["L2-KEKURANGAN", "L2-UJIAN-TANPA-BEBAN"]);
  });
});

describe("lapis 1 — beban per pertemuan", () => {
  const pagu = paguPertemuanEfektif(kebijakan, TEORI_3SKS); // 510

  it("angka TI214 yang tertulis (580 menit) melebihi pagu lebih dari 10%", () => {
    const temuan = validasiPertemuan(
      pagu,
      [
        { kategori: "TM", menit: 120 },
        { kategori: "PT", menit: 180 },
        { kategori: "BM", menit: 280 },
      ],
      kebijakan.toleransiPertemuanPersen,
      2,
    );
    const kelebihan = temuan.find((t) => t.kode === "L1-KELEBIHAN");
    assert.ok(kelebihan, "seharusnya menandai kelebihan beban");
    assert.equal(kelebihan?.detail?.persen, 13.7);
  });

  it("beban pas pagu tidak menghasilkan temuan", () => {
    const temuan = validasiPertemuan(
      pagu,
      [
        { kategori: "TM", menit: 150 },
        { kategori: "PT", menit: 180 },
        { kategori: "BM", menit: 180 },
      ],
      kebijakan.toleransiPertemuanPersen,
    );
    assert.deepEqual(temuan, []);
  });

  it("tatap muka melebihi pagu TM ditandai terpisah — slot ruang itu nyata", () => {
    const temuan = validasiPertemuan(
      pagu,
      [
        { kategori: "TM", menit: 240 },
        { kategori: "PT", menit: 150 },
        { kategori: "BM", menit: 120 },
      ],
      kebijakan.toleransiPertemuanPersen,
    );
    assert.ok(temuan.some((t) => t.kode === "L1-TM-LEBIH"));
  });
});

describe("lapis 3 — konsistensi narasi (temuan B4 pada TI214)", () => {
  it("480 menit di narasi vs 580 di kolom alokasi = pemblokir", () => {
    const temuan = validasiKonsistensiNarasi(480, 580, 2);
    assert.equal(temuan.length, 1);
    assert.equal(temuan[0].tingkat, "PEMBLOKIR");
    assert.equal(temuan[0].detail?.selisih, 100);
  });

  it("angka sama tidak menghasilkan temuan", () => {
    assert.deepEqual(validasiKonsistensiNarasi(510, 510), []);
  });
});

describe("beban mahasiswa per semester (docs/03 §4.4)", () => {
  it("24 sks setara 67,5 jam per minggu", () => {
    const b = bebanMahasiswa(kebijakan, 24);
    assert.equal(b.jamSemester, 1080);
    assert.equal(b.jamPerMinggu, 67.5);
    assert.equal(b.setaraKerjaPenuh, 1.69);
  });

  it("20 sks setara 56,3 jam per minggu", () => {
    assert.equal(bebanMahasiswa(kebijakan, 20).jamPerMinggu, 56.3);
  });
});

describe("format menit", () => {
  it("menampilkan jam dan menit", () => {
    assert.equal(formatMenit(510), "8 jam 30 menit");
    assert.equal(formatMenit(480), "8 jam");
    assert.equal(formatMenit(45), "45 menit");
    assert.equal(formatMenit(-960), "-16 jam");
  });
});
