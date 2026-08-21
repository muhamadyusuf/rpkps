import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { periksaDraf, ringkasDraf, type DrafRpkps, type KonteksDraf } from "./draf";

function konteks(): KonteksDraf {
  return {
    mingguEfektif: [1, 2, 3],
    semuaMinggu: [1, 2, 3, 4],
    subCpmkTersedia: ["CPMK081-1", "CPMK081-2"],
    refPustaka: ["UTAMA-1", "UTAMA-2"],
  };
}

function pertemuan(minggu: number, bobot: number) {
  return {
    minggu,
    topik: `Topik minggu ${minggu}`,
    subtopik: ["a", "b"],
    metodeNarasi: "Kuliah dan diskusi.",
    aktivitasDosen: "Menjelaskan konsep.",
    aktivitasMahasiswa: "Mengerjakan latihan.",
    tugasTerstruktur: null,
    penilaianJenis: "Kuis",
    penilaianSistem: "Skor 0-100",
    bobot,
    indikator: ["Ketepatan jawaban"],
    pustakaRef: ["UTAMA-1"],
  };
}

function draf(): DrafRpkps {
  return {
    deskripsi:
      "Mata kuliah ini membahas konsep dan perancangan basis data relasional, " +
      "mulai dari pemodelan konseptual hingga implementasi dan optimasi kueri.",
    kalimatPembukaCpmk: "Setelah menyelesaikan mata kuliah ini, mahasiswa mampu:",
    komponenNilai: [
      { nama: "Ujian Tengah Semester", bobot: 40 },
      { nama: "Tugas", bobot: 60 },
    ],
    pustakaBaru: [
      { jenis: "UTAMA", nomor: 3, teks: "Elmasri & Navathe (2016). Fundamentals of Database Systems.", url: null },
    ],
    pertemuan: [pertemuan(1, 30), pertemuan(2, 30), pertemuan(3, 40)],
    tugas: [
      {
        nomor: 1,
        nama: "Studi kasus basis data",
        jenis: "KELOMPOK",
        mingguMulai: 2,
        mingguSelesai: 3,
        bobot: 60,
        komponenNilai: "Tugas",
        deskripsi: "Menganalisis kebutuhan data sebuah organisasi.",
        uraianTugas: "Mahasiswa menyusun laporan.",
        formatLuaran: "Laporan PDF",
        subCpmkKode: ["CPMK081-1"],
        kriteria: [
          { nomor: 1, indikator: "Ketepatan analisis", rincian: [], bobot: 60 },
          { nomor: 2, indikator: "Kelengkapan laporan", rincian: [], bobot: 40 },
        ],
      },
    ],
    kisiKisi: [
      {
        jenis: "UTS",
        durasiMenit: 90,
        butir: [
          { nomor: 1, subCpmkKode: "CPMK081-1", levelBloom: "C2", bentuk: "ESAI", jumlahButir: 2, skor: 50, indikator: null },
          { nomor: 2, subCpmkKode: "CPMK081-2", levelBloom: "C3", bentuk: "ESAI", jumlahButir: 2, skor: 50, indikator: null },
        ],
      },
    ],
  };
}

describe("periksaDraf — draf sehat", () => {
  it("lolos tanpa temuan", () => {
    assert.deepEqual(periksaDraf(konteks(), draf()), []);
  });

  it("meringkas isinya untuk pratinjau", () => {
    assert.deepEqual(ringkasDraf(draf()), {
      jumlahPertemuan: 3,
      jumlahIndikator: 3,
      jumlahTugas: 1,
      jumlahButirUjian: 2,
      jumlahKomponen: 2,
      jumlahPustakaBaru: 1,
      bobotMingguan: 100,
    });
  });
});

describe("periksaDraf — batas yang tidak boleh dilanggar model", () => {
  it("menolak pustaka karangan", () => {
    const d = draf();
    d.pertemuan[0].pustakaRef = ["UTAMA-1", "UTAMA-9"];
    const t = periksaDraf(konteks(), d);
    assert.equal(t.filter((x) => x.kode === "D-PUSTAKA-KARANGAN").length, 1);
    assert.match(t[0].pesan, /UTAMA-9/);
  });

  it("menolak pengisian minggu ujian", () => {
    const d = draf();
    d.pertemuan.push(pertemuan(4, 0));
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-MINGGU-BUKAN-EFEKTIF"));
  });

  it("menuntut seluruh pertemuan efektif terisi", () => {
    const d = draf();
    d.pertemuan = [pertemuan(1, 100)];
    const t = periksaDraf(konteks(), d);
    const x = t.find((y) => y.kode === "D-MINGGU-BELUM-DIISI");
    assert.ok(x);
    assert.match(x!.pesan, /2, 3/);
  });

  it("menolak bobot mingguan yang tidak 100%", () => {
    const d = draf();
    d.pertemuan[0].bobot = 25;
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-BOBOT-MINGGUAN"));
  });

  it("memeriksa bobot mingguan dan bobot komponen sebagai dua tuntutan terpisah", () => {
    const d = draf();
    d.pertemuan[0].bobot = 20; // mingguan jadi 90
    d.komponenNilai = [{ nama: "Tugas", bobot: 70 }];
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-BOBOT-MINGGUAN"));
    assert.ok(t.some((x) => x.kode === "D-BOBOT-KOMPONEN"));
  });

  it("menolak Sub-CPMK asing pada tugas dan pada kisi-kisi", () => {
    const d = draf();
    d.tugas[0].subCpmkKode = ["CPMK999-1"];
    d.kisiKisi[0].butir[0].subCpmkKode = "CPMK999-2";
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-TUGAS-SUB-CPMK-ASING"));
    assert.ok(t.some((x) => x.kode === "D-KISI-SUB-CPMK-ASING"));
  });

  it("menolak komponen nilai yang tidak ada pada RPKPS", () => {
    const d = draf();
    d.tugas[0].komponenNilai = "Komponen Karangan";
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-TUGAS-KOMPONEN-ASING"));
  });

  it("menolak bobot kriteria tugas yang tidak 100%", () => {
    const d = draf();
    d.tugas[0].kriteria[1].bobot = 10;
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-TUGAS-BOBOT-KRITERIA"));
  });

  it("menolak rentang minggu tugas di luar semester", () => {
    const d = draf();
    d.tugas[0].mingguSelesai = 20;
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-TUGAS-MINGGU-DILUAR"));
  });

  it("menolak total skor kisi-kisi yang bukan 100", () => {
    const d = draf();
    d.kisiKisi[0].butir[0].skor = 30;
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-KISI-TOTAL-SKOR"));
  });

  it("menandai pertemuan berbobot yang tidak punya indikator", () => {
    const d = draf();
    d.pertemuan[0].indikator = [];
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-BERBOBOT-TANPA-INDIKATOR"));
  });

  // Nilai enum datang dari kiriman klien saat persetujuan, jadi tipe TypeScript
  // sudah hilang. Pemeriksaannya harus runtime — ini yang dulu kebobolan dan
  // membuat penulisan gagal di basis data.
  it("menolak jenis tugas di luar enum basis data", () => {
    const d = draf();
    (d.tugas[0] as { jenis: string }).jenis = "PROYEK";
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-TUGAS-JENIS-ASING"));
  });

  it("menolak bentuk soal dan level Bloom di luar enum", () => {
    const d = draf();
    (d.kisiKisi[0].butir[0] as { bentuk: string }).bentuk = "TEBAK_GAMBAR";
    (d.kisiKisi[0].butir[1] as { levelBloom: string }).levelBloom = "C9";
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-BUTIR-BENTUK-ASING"));
    assert.ok(t.some((x) => x.kode === "D-BUTIR-LEVEL-ASING"));
  });

  it("menolak nomor kriteria dan nomor butir yang berulang", () => {
    const d = draf();
    d.tugas[0].kriteria[1].nomor = 1;
    d.kisiKisi[0].butir[1].nomor = 1;
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-KRITERIA-NOMOR-GANDA"));
    assert.ok(t.some((x) => x.kode === "D-BUTIR-NOMOR-GANDA"));
  });

  // Rujukan ganda menabrak kunci gabungan PertemuanPustaka/TugasSubCpmk. Ini
  // pernah menjatuhkan penulisan setelah draf dinyatakan sah.
  it("menandai rujukan pustaka yang berulang pada satu minggu", () => {
    const d = draf();
    d.pertemuan[0].pustakaRef = ["UTAMA-1", "UTAMA-1"];
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-PUSTAKA-BERULANG"));
  });

  it("menandai Sub-CPMK yang ditagih dua kali oleh tugas yang sama", () => {
    const d = draf();
    d.tugas[0].subCpmkKode = ["CPMK081-1", "CPMK081-1"];
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-TUGAS-SUB-CPMK-BERULANG"));
  });

  it("menolak total bobot komponen nilai yang bukan 100%", () => {
    const d = draf();
    d.komponenNilai = [{ nama: "Tugas", bobot: 70 }];
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-BOBOT-KOMPONEN"));
  });

  it("menolak nomor pustaka baru yang bentrok dengan yang sudah ada", () => {
    const d = draf();
    d.pustakaBaru[0].nomor = 1; // UTAMA-1 sudah dipakai
    assert.ok(periksaDraf(konteks(), d).some((x) => x.kode === "D-PUSTAKA-NOMOR-BENTROK"));
  });

  it("menerima rujukan ke pustaka yang baru diusulkan AI", () => {
    const d = draf();
    d.pertemuan[0].pustakaRef = ["UTAMA-3"]; // dari pustakaBaru
    assert.deepEqual(periksaDraf(konteks(), d), []);
  });

  it("menolak deskripsi dan kalimat pembuka yang terlalu pendek", () => {
    const d = draf();
    d.deskripsi = "Basis data.";
    d.kalimatPembukaCpmk = "Mampu.";
    const t = periksaDraf(konteks(), d);
    assert.ok(t.some((x) => x.kode === "D-DESKRIPSI-PENDEK"));
    assert.ok(t.some((x) => x.kode === "D-PEMBUKA-PENDEK"));
  });
});
