import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bandingkanLevel,
  deteksiKko,
  deteksiKkoTidakTerukur,
  hitungKkoBerbeda,
} from "./bloom";
import { validasiKurikulum } from "./validator";
import type { KurikulumInput } from "./tipe";

/** Kurikulum minimal yang sehat, dipakai sebagai dasar variasi uji. */
function kurikulumSehat(): KurikulumInput {
  return {
    nama: "Kurikulum TI 2025",
    tahun: 2025,
    cpl: [
      { kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis, kritis, dan sistematis.", tingkatKkni: 6 },
      { kode: "CPL08", deskripsi: "Mampu merancang dan mengimplementasi solusi berbasis computing.", tingkatKkni: 6 },
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
            rumusan: "Mampu merancang solusi basis data yang optimal.",
            levelBloom: "C6",
            cplKode: ["CPL08"],
            subCpmk: [
              {
                kode: "CPMK081-1",
                rumusan: "Mahasiswa mampu menjelaskan konsep dasar sistem basis data.",
                levelBloom: "C2",
              },
              {
                kode: "CPMK081-3",
                rumusan: "Mahasiswa mampu merancang model konseptual basis data menggunakan ERD.",
                levelBloom: "C6",
              },
            ],
          },
          {
            kode: "CPMK062",
            rumusan: "Mampu menganalisis kebutuhan data secara sistematis.",
            levelBloom: "C4",
            cplKode: ["CPL06"],
            subCpmk: [
              {
                kode: "CPMK062-1",
                rumusan: "Mahasiswa mampu menganalisis kebutuhan pengguna dari narasi kasus.",
                levelBloom: "C4",
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("kamus KKO dan Bloom", () => {
  it("mendeteksi kata kerja operasional beserta levelnya", () => {
    assert.deepEqual(
      deteksiKko("Mahasiswa mampu merancang model konseptual basis data"),
      { kko: "merancang", level: "C6" },
    );
    assert.equal(deteksiKko("Mahasiswa mampu menjelaskan perbedaan")?.level, "C2");
  });

  it("menandai kata yang tidak dapat diamati", () => {
    assert.deepEqual(
      deteksiKkoTidakTerukur("Mahasiswa mampu menguasai konsep normalisasi"),
      ["menguasai"],
    );
    assert.deepEqual(deteksiKkoTidakTerukur("Mahasiswa mampu menerapkan normalisasi"), []);
  });

  // Kamus KKO ITTS memetakan "memahami" ke C2, jadi aplikasi memperlakukannya
  // sebagai kata kerja sah meski secara teori Bloom ia tidak terukur.
  it('"memahami" mengikuti kamus ITTS: sah di C2, bukan kata tak terukur', () => {
    assert.deepEqual(deteksiKkoTidakTerukur("Mahasiswa mampu memahami normalisasi"), []);
    assert.equal(deteksiKko("Mahasiswa mampu memahami normalisasi")?.level, "C2");
  });

  it("menghitung kata kerja ganda dalam satu rumusan", () => {
    const ganda = hitungKkoBerbeda(
      "Mahasiswa mampu menjelaskan dan merancang skema basis data",
    );
    assert.ok(ganda.length >= 2, `harusnya >1, dapat ${ganda.join(",")}`);
  });

  it("tidak membandingkan level lintas ranah", () => {
    assert.equal(bandingkanLevel("C3", "C5"), -2);
    assert.equal(bandingkanLevel("C3", "P2"), null);
  });
});

describe("kurikulum yang sehat", () => {
  it("lolos tanpa pemblokir", () => {
    const hasil = validasiKurikulum(kurikulumSehat());
    assert.equal(
      hasil.lolos,
      true,
      `masih ada pemblokir: ${hasil.pemblokir.map((t) => t.kode).join(", ")}`,
    );
    assert.equal(hasil.ringkasan.jumlahCpl, 2);
    assert.equal(hasil.ringkasan.jumlahCpmk, 2);
    assert.equal(hasil.ringkasan.jumlahSubCpmk, 3);
  });
});

describe("temuan B3 pada TI214 — CPL dibebankan tapi tidak dijabarkan", () => {
  it("CPL06 tanpa CPMK yang menjabarkannya adalah pemblokir", () => {
    const k = kurikulumSehat();
    // Persis kondisi dokumen asli: CPL06 tercantum di B.1, tetapi seluruh
    // CPMK hanya menjabarkan CPL08.
    k.mataKuliah[0].cpmk = k.mataKuliah[0].cpmk.filter((c) => c.kode !== "CPMK062");

    const hasil = validasiKurikulum(k);
    assert.equal(hasil.lolos, false);

    const temuan = hasil.pemblokir.find((t) => t.kode === "K-MK-CPL-TIDAK-DIJABARKAN");
    assert.ok(temuan, "seharusnya menandai CPL yang tidak dijabarkan");
    assert.match(temuan!.pesan, /CPL06/);
    assert.match(temuan!.pesan, /tidak akan pernah dinilai/);
  });
});

describe("aturan rantai CPL - CPMK - Sub-CPMK", () => {
  it("CPL yang tidak dipakai mata kuliah mana pun ditandai", () => {
    const k = kurikulumSehat();
    k.cpl.push({ kode: "CPL09", deskripsi: "Mampu bekerja dalam tim lintas disiplin." });
    const hasil = validasiKurikulum(k);
    assert.deepEqual(hasil.ringkasan.cplTanpaMk, ["CPL09"]);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-CPL-TANPA-MK"));
  });

  it("CPMK tanpa Sub-CPMK adalah pemblokir", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cpmk[0].subCpmk = [];
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-CPMK-TANPA-SUB"));
  });

  it("CPMK yang menjabarkan CPL di luar beban MK ditandai", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cplKode = ["CPL08"]; // CPL06 dilepas dari matriks
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-CPMK-CPL-DILUAR-MK"));
  });

  it("rujukan ke CPL yang tidak ada ditandai", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cpmk[0].cplKode = ["CPL99"];
    k.mataKuliah[0].cplKode = ["CPL99", "CPL06"];
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-CPMK-CPL-TIDAK-ADA"));
  });

  it("kode Sub-CPMK berulang ditandai", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cpmk[0].subCpmk[1].kode = "CPMK081-1";
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-SUB-KODE-GANDA"));
  });
});

describe("mutu rumusan", () => {
  it('"menguasai" ditandai sebagai tidak terukur', () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cpmk[0].subCpmk[0].rumusan =
      "Mahasiswa mampu menguasai konsep dasar sistem basis data relasional.";
    k.mataKuliah[0].cpmk[0].subCpmk[0].levelBloom = "C2";
    const hasil = validasiKurikulum(k);
    const t = hasil.peringatan.find((x) => x.kode === "K-SUB-TIDAK-TERUKUR");
    assert.ok(t);
    assert.match(t!.pesan, /menguasai/);
  });

  it("Sub-CPMK tidak boleh melampaui level CPMK induknya", () => {
    const k = kurikulumSehat();
    // CPMK062 ada di C4; Sub-CPMK-nya dinaikkan ke C6.
    k.mataKuliah[0].cpmk[1].subCpmk[0] = {
      kode: "CPMK062-1",
      rumusan: "Mahasiswa mampu merancang arsitektur data perusahaan secara menyeluruh.",
      levelBloom: "C6",
    };
    const hasil = validasiKurikulum(k);
    const t = hasil.pemblokir.find((x) => x.kode === "K-SUB-LEVEL-LEBIH-TINGGI");
    assert.ok(t);
    assert.match(t!.pesan, /C6/);
    assert.match(t!.pesan, /C4/);
  });

  it("dua kata kerja dalam satu Sub-CPMK disarankan dipecah", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].cpmk[0].subCpmk[0].rumusan =
      "Mahasiswa mampu menjelaskan konsep normalisasi dan merancang skema relasional.";
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.peringatan.some((t) => t.kode === "K-SUB-KKO-GANDA"));
  });
});

describe("mata kuliah", () => {
  it("sks nol adalah pemblokir", () => {
    const k = kurikulumSehat();
    k.mataKuliah[0].sksTeori = 0;
    k.mataKuliah[0].sksPraktik = 0;
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-MK-SKS-NOL"));
  });

  it("kode mata kuliah berulang ditandai", () => {
    const k = kurikulumSehat();
    k.mataKuliah.push({ ...k.mataKuliah[0] });
    const hasil = validasiKurikulum(k);
    assert.ok(hasil.pemblokir.some((t) => t.kode === "K-MK-KODE-GANDA"));
  });
});
