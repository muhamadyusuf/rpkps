import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ringkasSaringan,
  saringDrafUsulan,
  type BahanDraf,
  type ButirDraf,
} from "./draf-usulan";
import { periksaButir } from "./usulan";
import type { KurikulumInput } from "./tipe";

/**
 * Uji fase U3a — docs/04 §9.3–9.4.
 *
 * Seluruh berkas ini tidak memanggil AI sama sekali: "keluaran model" adalah
 * fixture yang ditulis tangan, termasuk keluaran yang dikarang. Justru itu
 * intinya — aturan yang melindungi §2.3 harus teruji SEBELUM ada jalan bagi
 * jawaban model masuk ke basis data.
 */

function bahan(): BahanDraf {
  return {
    mkKode: "TI214",
    cpmkKode: ["CPMK081", "CPMK062"],
    subCpmkKode: ["CPMK081-1", "CPMK081-2", "CPMK062-1"],
    cplDibebankan: ["CPL06", "CPL08"],
    dasar: [
      {
        ref: "K-SUB-TIDAK-TERUKUR",
        jenis: "TEMUAN_VALIDATOR",
        kutipan:
          'Sub-CPMK CPMK081-1 memakai kata "memahami" yang tidak dapat diamati.',
        cpmkKode: "CPMK081",
        subCpmkKode: "CPMK081-1",
      },
      {
        ref: "K-CPMK-TANPA-CPL",
        jenis: "TEMUAN_VALIDATOR",
        kutipan: "CPMK062 belum menjabarkan satu pun CPL yang dibebankan.",
        cpmkKode: "CPMK062",
      },
      {
        ref: "te_9f2",
        jenis: "TEMUAN_EVALUASI",
        kutipan:
          "CPMK081-2 hanya dicapai 41% mahasiswa selama dua semester berturut-turut.",
        cpmkKode: "CPMK081",
        subCpmkKode: "CPMK081-2",
      },
    ],
    catatanDosen:
      "Rumusan CPMK081-1 sudah tidak sesuai praktik: mahasiswa kini langsung " +
      "bekerja dengan basis data terdistribusi sejak semester tiga.",
  };
}

/** Butir draf yang seluruhnya sah, menyasar CPMK081-1. */
function butirSah(): ButirDraf {
  return {
    jenis: "SUB_RUMUSAN",
    cpmkKode: "CPMK081",
    subCpmkKode: "CPMK081-1",
    rumusan:
      "Mahasiswa mampu menjelaskan konsep dasar basis data relasional beserta contohnya.",
    levelBloom: "C2",
    alasan:
      'Kata "memahami" diganti KKO yang dapat diamati agar Sub-CPMK ini dapat dinilai.',
    dasarRef: ["K-SUB-TIDAK-TERUKUR"],
  };
}

function kode(hasil: { dibuang: { kode: string }[] }): string[] {
  return hasil.dibuang.map((d) => d.kode);
}

describe("draf yang sah", () => {
  it("meloloskan butir yang seluruh rujukannya nyata", () => {
    const h = saringDrafUsulan(bahan(), [butirSah()]);
    assert.deepEqual(h.dibuang, []);
    assert.equal(h.butir.length, 1);
    assert.equal(h.butir[0].jenis, "SUB_RUMUSAN");
    assert.equal(h.butir[0].subCpmkKode, "CPMK081-1");
  });

  it("menyalin kutipan dari katalog, BUKAN dari jawaban model", () => {
    // Model menyebut ref yang benar tetapi menempelkan kalimatnya sendiri
    // lewat field yang tidak ada. Yang tersimpan harus tetap kalimat katalog.
    const d = { ...butirSah(), kutipan: "Kalimat karangan model." } as ButirDraf;
    const h = saringDrafUsulan(bahan(), [d]);

    assert.equal(h.butir[0].dasar.length, 1);
    assert.equal(
      h.butir[0].dasar[0].kutipan,
      'Sub-CPMK CPMK081-1 memakai kata "memahami" yang tidak dapat diamati.',
    );
    assert.equal(h.butir[0].dasar[0].jenis, "TEMUAN_VALIDATOR");
  });

  it("merapikan kode yang ditulis huruf kecil", () => {
    const d = { ...butirSah(), cpmkKode: "cpmk081", subCpmkKode: "cpmk081-1" };
    const h = saringDrafUsulan(bahan(), [d]);
    assert.equal(h.butir[0].cpmkKode, "CPMK081");
    assert.equal(h.butir[0].subCpmkKode, "CPMK081-1");
  });

  it("membolehkan SUB_BARU menempel pada CPMK yang diperkenalkan draf yang sama", () => {
    const h = saringDrafUsulan(bahan(), [
      {
        jenis: "CPMK_BARU",
        cpmkKode: "CPMK099",
        rumusan: "Mampu merancang basis data terdistribusi.",
        levelBloom: "C6",
        cplKode: ["CPL08"],
        alasan: "Kebutuhan basis data terdistribusi belum tercakup capaian mana pun.",
        dasarRef: [],
        kutipanCatatan: "mahasiswa kini langsung bekerja dengan basis data terdistribusi",
      },
      {
        jenis: "SUB_BARU",
        cpmkKode: "CPMK099",
        subCpmkKode: "CPMK099-1",
        rumusan: "Mahasiswa mampu menjelaskan model replikasi data.",
        levelBloom: "C2",
        alasan: "Tahapan pertama menuju perancangan basis data terdistribusi.",
        dasarRef: [],
        kutipanCatatan: "mahasiswa kini langsung bekerja dengan basis data terdistribusi",
      },
    ]);

    assert.deepEqual(kode(h), []);
    assert.equal(h.butir.length, 2);
  });

  it("hasil saringan lolos periksaButir tanpa keringanan apa pun", () => {
    // Bukti bahwa penyaring tidak menghasilkan butir yang justru diblokir
    // validator domain — dua lapis itu harus bersambung, bukan bertengkar.
    const kurikulum: KurikulumInput = {
      nama: "Kurikulum TI 2025",
      tahun: 2025,
      cpl: [
        { kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis." },
        { kode: "CPL08", deskripsi: "Mampu merancang solusi berbasis computing." },
      ],
      mataKuliah: [
        {
          kode: "TI214",
          nama: "Basis Data",
          semester: 2,
          sksTeori: 2,
          sksPraktik: 1,
          cplKode: ["CPL06", "CPL08"],
          cpmk: [
            {
              kode: "CPMK081",
              rumusan: "Mampu merancang basis data relasional yang ternormalisasi.",
              levelBloom: "C6",
              cplKode: ["CPL08"],
              subCpmk: [
                {
                  kode: "CPMK081-1",
                  rumusan: "Mahasiswa mampu memahami konsep dasar basis data.",
                  levelBloom: "C2",
                },
                {
                  kode: "CPMK081-2",
                  rumusan: "Mahasiswa mampu menyusun skema relasional ternormalisasi.",
                  levelBloom: "C6",
                },
              ],
            },
            {
              kode: "CPMK062",
              rumusan: "Mampu membandingkan kebutuhan data secara sistematis.",
              levelBloom: "C4",
              cplKode: ["CPL06"],
              subCpmk: [
                {
                  kode: "CPMK062-1",
                  rumusan: "Mahasiswa mampu mengidentifikasi kebutuhan data.",
                  levelBloom: "C1",
                },
              ],
            },
          ],
        },
      ],
    };

    const h = saringDrafUsulan(bahan(), [butirSah()]);
    const temuan = periksaButir(kurikulum, { mkKode: "TI214", butir: h.butir });

    assert.deepEqual(temuan, [], JSON.stringify(temuan, null, 2));
  });
});

describe("dasar tidak boleh dikarang", () => {
  it("membuang butir yang menyebut dasar di luar katalog", () => {
    const d = { ...butirSah(), dasarRef: ["K-SUB-ENTAH-APA"] };
    const h = saringDrafUsulan(bahan(), [d]);

    assert.deepEqual(kode(h), ["D-DASAR-KARANGAN"]);
    assert.equal(h.butir.length, 0);
    assert.match(h.dibuang[0].alasan, /tidak ada pada bahan/);
  });

  it("membuang butir yang memasangkan dasar nyata pada sasaran lain", () => {
    // Penyelewengan paling halus: rujukannya benar-benar ada, hanya
    // pasangannya yang salah. Temuan pada CPMK081-1 bukan alasan mengubah
    // CPMK081-2.
    const d = {
      ...butirSah(),
      subCpmkKode: "CPMK081-2",
      dasarRef: ["K-SUB-TIDAK-TERUKUR"],
    };
    const h = saringDrafUsulan(bahan(), [d]);

    assert.deepEqual(kode(h), ["D-DASAR-BEDA-SASARAN"]);
  });

  it("membolehkan temuan Sub-CPMK menjadi dasar perbaikan CPMK induknya", () => {
    // K-SUB-LEVEL-LEBIH-TINGGI lazim diselesaikan dengan menaikkan level CPMK
    // induk, bukan menurunkan Sub-CPMK-nya. Menutup jalan itu berarti menolak
    // perbaikan yang justru dianjurkan.
    const h = saringDrafUsulan(bahan(), [
      {
        jenis: "CPMK_RUMUSAN",
        cpmkKode: "CPMK081",
        rumusan: "Mampu merancang dan mengevaluasi basis data relasional ternormalisasi.",
        levelBloom: "C6",
        alasan: "Level CPMK induk dinaikkan agar tidak dilampaui tahapan di bawahnya.",
        dasarRef: ["te_9f2"],
      },
    ]);

    assert.deepEqual(kode(h), []);
    assert.equal(h.butir[0].dasar[0].ref, "te_9f2");
  });

  it("tetap menolak dasar dari CPMK yang berbeda", () => {
    const d = {
      ...butirSah(),
      cpmkKode: "CPMK062",
      subCpmkKode: "CPMK062-1",
      dasarRef: ["K-SUB-TIDAK-TERUKUR"],
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-DASAR-BEDA-SASARAN"]);
  });

  it("membuang butir yang tidak bersandar pada apa pun", () => {
    const d = { ...butirSah(), dasarRef: [], kutipanCatatan: null };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-TANPA-DASAR"]);
  });

  it("menerima dasar tingkat CPMK bagi butir tingkat CPMK", () => {
    const h = saringDrafUsulan(bahan(), [
      {
        jenis: "CPMK_PETA_CPL",
        cpmkKode: "CPMK062",
        cplKode: ["CPL06"],
        alasan: "CPMK062 belum menjabarkan CPL mana pun sehingga capaiannya tidak terukur.",
        dasarRef: ["K-CPMK-TANPA-CPL"],
      },
    ]);
    assert.deepEqual(kode(h), []);
    assert.equal(h.butir[0].dasar[0].ref, "K-CPMK-TANPA-CPL");
  });

  it("menerima temuan evaluasi sebagai dasar", () => {
    const h = saringDrafUsulan(bahan(), [
      {
        jenis: "SUB_RUMUSAN",
        cpmkKode: "CPMK081",
        subCpmkKode: "CPMK081-2",
        rumusan: "Mahasiswa mampu menyusun skema relasional ternormalisasi hingga 3NF.",
        levelBloom: "C6",
        alasan: "Rumusan dipertegas batas normalisasinya karena capaiannya rendah berulang.",
        dasarRef: ["te_9f2"],
      },
    ]);
    assert.deepEqual(kode(h), []);
    assert.equal(h.butir[0].dasar[0].jenis, "TEMUAN_EVALUASI");
  });
});

describe("catatan dosen wajib verbatim", () => {
  it("menerima kutipan yang benar-benar ada pada catatan", () => {
    const d = {
      ...butirSah(),
      dasarRef: [],
      kutipanCatatan: "mahasiswa kini langsung bekerja dengan basis data terdistribusi",
    };
    const h = saringDrafUsulan(bahan(), [d]);

    assert.deepEqual(kode(h), []);
    assert.equal(h.butir[0].dasar[0].jenis, "CATATAN_DOSEN");
    assert.equal(h.butir[0].dasar[0].ref, null);
  });

  it("tidak peduli beda spasi dan huruf besar", () => {
    const d = {
      ...butirSah(),
      dasarRef: [],
      kutipanCatatan: "Mahasiswa  kini   LANGSUNG bekerja\ndengan basis data terdistribusi",
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), []);
  });

  it("membuang kutipan yang tidak ada pada catatan dosen", () => {
    // Di sinilah pendapat model dicuci menjadi pendapat manusia bila lolos.
    const d = {
      ...butirSah(),
      dasarRef: [],
      kutipanCatatan: "Dosen menyatakan materi ini sudah usang menurut tren industri.",
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KUTIPAN-KARANGAN"]);
  });

  it("membuang kutipan saat dosen tidak menulis catatan sama sekali", () => {
    const b = { ...bahan(), catatanDosen: null };
    const d = { ...butirSah(), dasarRef: [], kutipanCatatan: "apa pun yang cukup panjang" };
    assert.deepEqual(kode(saringDrafUsulan(b, [d])), ["D-CATATAN-TIDAK-ADA"]);
  });

  it("membuang kutipan yang terlalu pendek untuk menjadi dasar", () => {
    const d = { ...butirSah(), dasarRef: [], kutipanCatatan: "Rumusan" };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KUTIPAN-PENDEK"]);
  });
});

describe("jenis butir di luar kewenangan AI", () => {
  for (const jenis of ["CPMK_PENSIUN", "SUB_PENSIUN"]) {
    it(`membuang ${jenis}`, () => {
      const d = { ...butirSah(), jenis };
      assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-JENIS-TERLARANG"]);
    });
  }

  it("membuang jenis yang tidak dikenal sama sekali", () => {
    const d = { ...butirSah(), jenis: "HAPUS_CPMK" };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-JENIS-TERLARANG"]);
  });

  it("membolehkan CATATAN_CPL — di situlah temuan di luar kewenangan mendarat", () => {
    const h = saringDrafUsulan(bahan(), [
      {
        jenis: "CATATAN_CPL",
        cpmkKode: "CPMK062",
        alasan:
          "Kesenjangan ini sebenarnya ada pada rumusan CPL06, di luar kewenangan usulan MK.",
        dasarRef: ["K-CPMK-TANPA-CPL"],
      },
    ]);
    assert.deepEqual(kode(h), []);
    assert.equal(h.butir[0].jenis, "CATATAN_CPL");
  });
});

describe("kode dan isi yang dikarang", () => {
  it("membuang butir yang menunjuk CPMK tidak ada", () => {
    const d = { ...butirSah(), cpmkKode: "CPMK999", subCpmkKode: null, dasarRef: [], kutipanCatatan: "mahasiswa kini langsung bekerja dengan basis data terdistribusi" };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KODE-TIDAK-DIKENAL"]);
  });

  it("membuang butir yang menunjuk Sub-CPMK tidak ada", () => {
    const d = { ...butirSah(), subCpmkKode: "CPMK081-9" };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KODE-TIDAK-DIKENAL"]);
  });

  it("membuang CPMK_BARU yang kodenya sudah dipakai", () => {
    const d: ButirDraf = {
      jenis: "CPMK_BARU",
      cpmkKode: "CPMK081",
      rumusan: "Mampu merancang basis data terdistribusi.",
      alasan: "Capaian basis data terdistribusi belum tercakup mana pun.",
      dasarRef: ["K-CPMK-TANPA-CPL"],
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KODE-BENTROK"]);
  });

  it("membuang SUB_BARU yang kodenya sudah dipakai", () => {
    const d: ButirDraf = {
      jenis: "SUB_BARU",
      cpmkKode: "CPMK081",
      subCpmkKode: "CPMK081-1",
      rumusan: "Mahasiswa mampu menjelaskan replikasi data.",
      alasan: "Tahapan ini belum ada padahal materinya diajarkan.",
      dasarRef: ["K-SUB-TIDAK-TERUKUR"],
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-KODE-BENTROK"]);
  });

  it("membuang butir yang mengarang kode CPL", () => {
    const d: ButirDraf = {
      jenis: "CPMK_PETA_CPL",
      cpmkKode: "CPMK062",
      cplKode: ["CPL06", "CPL11"],
      alasan: "Pemetaan CPL diperbaiki agar capaian mata kuliah ini terukur.",
      dasarRef: ["K-CPMK-TANPA-CPL"],
    };
    const h = saringDrafUsulan(bahan(), [d]);
    assert.deepEqual(kode(h), ["D-CPL-ASING"]);
    assert.match(h.dibuang[0].alasan, /CPL11/);
  });

  it("membuang CPMK_PETA_CPL yang tidak menyebut satu pun CPL", () => {
    const d: ButirDraf = {
      jenis: "CPMK_PETA_CPL",
      cpmkKode: "CPMK062",
      cplKode: [],
      alasan: "Pemetaan CPL diperbaiki agar capaian mata kuliah ini terukur.",
      dasarRef: ["K-CPMK-TANPA-CPL"],
    };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-PETA-KOSONG"]);
  });

  it("membuang butir tanpa rumusan pada jenis yang mewajibkannya", () => {
    const d = { ...butirSah(), rumusan: "   " };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-RUMUSAN-KOSONG"]);
  });

  it("membuang butir yang alasannya terlalu ringkas", () => {
    const d = { ...butirSah(), alasan: "Perlu diganti." };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-ALASAN-PENDEK"]);
  });

  it("membuang level Bloom yang tidak ada di kamus", () => {
    const d = { ...butirSah(), levelBloom: "C9" };
    assert.deepEqual(kode(saringDrafUsulan(bahan(), [d])), ["D-LEVEL-ASING"]);
  });

  it("menyaring minggu di luar rentang tanpa membuang butirnya", () => {
    const d: ButirDraf = {
      jenis: "SUB_MINGGU",
      cpmkKode: "CPMK081",
      subCpmkKode: "CPMK081-2",
      mingguDisarankan: [3, 0, 40, 7],
      alasan: "Tahapan ini sebaiknya diajarkan lebih awal agar menopang tahapan berikutnya.",
      dasarRef: ["te_9f2"],
    };
    const h = saringDrafUsulan(bahan(), [d]);
    assert.deepEqual(kode(h), []);
    assert.deepEqual(h.butir[0].mingguDisarankan, [3, 7]);
  });
});

describe("satu butir per sasaran", () => {
  it("menyimpan yang pertama dan membuang kembarannya", () => {
    const h = saringDrafUsulan(bahan(), [butirSah(), { ...butirSah(), rumusan: "Versi lain." }]);
    assert.equal(h.butir.length, 1);
    assert.deepEqual(kode(h), ["D-SASARAN-GANDA"]);
  });

  it("dua jenis berbeda atas sasaran sama tetap boleh", () => {
    const h = saringDrafUsulan(bahan(), [
      butirSah(),
      {
        jenis: "SUB_MINGGU",
        cpmkKode: "CPMK081",
        subCpmkKode: "CPMK081-1",
        mingguDisarankan: [2],
        alasan: "Tahapan pengantar ini sebaiknya jatuh pada minggu kedua.",
        dasarRef: ["K-SUB-TIDAK-TERUKUR"],
      },
    ]);
    assert.deepEqual(kode(h), []);
    assert.equal(h.butir.length, 2);
  });
});

describe("ringkasan untuk panel", () => {
  it("menyebut jumlah yang dibuang beserta sebabnya", () => {
    const h = saringDrafUsulan(bahan(), [
      butirSah(),
      { ...butirSah(), subCpmkKode: "CPMK081-9" },
      { ...butirSah(), dasarRef: ["mengarang"] },
    ]);
    const teks = ringkasSaringan(h);

    assert.match(teks, /1 butir tersusun/);
    assert.match(teks, /2 dibuang/);
    assert.match(teks, /D-KODE-TIDAK-DIKENAL/);
    assert.match(teks, /D-DASAR-KARANGAN/);
  });

  it("tidak mengarang keluhan saat semuanya lolos", () => {
    assert.equal(
      ringkasSaringan(saringDrafUsulan(bahan(), [butirSah()])),
      "1 butir tersusun, tidak ada yang dibuang.",
    );
  });

  it("draf kosong menghasilkan nol butir tanpa galat", () => {
    const h = saringDrafUsulan(bahan(), []);
    assert.deepEqual(h.butir, []);
    assert.deepEqual(h.dibuang, []);
  });
});
