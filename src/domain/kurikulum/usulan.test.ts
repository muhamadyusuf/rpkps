import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  butirDipakai,
  jarakSunting,
  periksaAkibat,
  periksaButir,
  periksaJalurRalat,
  periksaKonsistensiKeputusan,
  periksaPenerapan,
  periksaUsulanRevisi,
  ringkasPenerapan,
  terapkanKeInput,
  type ButirInput,
  type UsulanInput,
} from "./usulan";
import type { KurikulumInput } from "./tipe";

function kurikulum(): KurikulumInput {
  return {
    nama: "Kurikulum TI 2025",
    tahun: 2025,
    cpl: [
      { kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis dan sistematis." },
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
                rumusan: "Mahasiswa mampu menjelaskan konsep dasar basis data relasional.",
                levelBloom: "C2",
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
                rumusan: "Mahasiswa mampu mengidentifikasi kebutuhan data pemangku kepentingan.",
                levelBloom: "C1",
              },
            ],
          },
        ],
      },
    ],
  };
}

const DASAR_SAH = [
  {
    jenis: "CATATAN_DOSEN" as const,
    kutipan: "Rumusan sekarang memakai kata kerja yang tidak dapat diamati.",
  },
];

function butir(ubah: Partial<ButirInput> = {}): ButirInput {
  return {
    id: "b1",
    jenis: "SUB_RUMUSAN",
    cpmkKode: "CPMK081",
    subCpmkKode: "CPMK081-1",
    rumusan: "Mahasiswa mampu menjelaskan komponen sistem basis data relasional.",
    alasan: "Rumusan lama tidak menyebut komponen yang harus dikenali mahasiswa.",
    dasar: DASAR_SAH,
    ...ubah,
  };
}

function usulan(butirs: ButirInput[], ubah: Partial<UsulanInput> = {}): UsulanInput {
  return { mkKode: "TI214", butir: butirs, ...ubah };
}

function kode(temuan: { kode: string }[]): string[] {
  return temuan.map((t) => t.kode);
}

describe("periksaButir — rujukan dan kelengkapan", () => {
  it("menerima butir yang menunjuk Sub-CPMK yang ada", () => {
    assert.deepEqual(periksaButir(kurikulum(), usulan([butir()])), []);
  });

  it("menolak butir tanpa satu pun dasar", () => {
    const temuan = periksaButir(kurikulum(), usulan([butir({ dasar: [] })]));
    assert.ok(kode(temuan).includes("U-TANPA-DASAR"));
  });

  it("menolak dasar berupa kutipan sangat pendek", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([butir({ dasar: [{ jenis: "CATATAN_DOSEN", kutipan: "salah" }] })]),
    );
    assert.ok(kode(temuan).includes("U-TANPA-DASAR"));
  });

  it("menuntut rujukan pada dasar selain catatan dosen", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([
        butir({
          dasar: [
            { jenis: "SINYAL_INDUSTRI", kutipan: "Permintaan kompetensi OLAP naik 40%." },
          ],
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("U-DASAR-TANPA-RUJUKAN"));
  });

  it("menolak alasan yang terlalu pendek untuk dinilai", () => {
    const temuan = periksaButir(kurikulum(), usulan([butir({ alasan: "kurang tepat" })]));
    assert.ok(kode(temuan).includes("U-ALASAN-PENDEK"));
  });

  it("menolak Sub-CPMK sasaran yang tidak ada", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([butir({ subCpmkKode: "CPMK081-9" })]),
    );
    assert.ok(kode(temuan).includes("U-SUB-TIDAK-ADA"));
  });

  /**
   * Kode tidak boleh didaur ulang: nomor Sub-CPMK yang tercetak di RPKPS lama
   * harus tetap menunjuk satu hal yang sama selamanya.
   */
  it("menolak kode baru yang sudah dipakai", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([
        butir({
          jenis: "SUB_BARU",
          subCpmkKode: "CPMK081-1",
          rumusan: "Mahasiswa mampu menerapkan indeks pada basis data terkelola.",
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("U-KODE-DIPAKAI-SUB"));
  });

  it("menuntut CPMK baru punya peta CPL dan minimal satu Sub-CPMK", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([
        butir({
          jenis: "CPMK_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: null,
          rumusan: "Mampu mengevaluasi skema basis data analitik.",
          cplKode: [],
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("U-CPMK-BARU-TANPA-CPL"));
    assert.ok(kode(temuan).includes("U-CPMK-BARU-TANPA-SUB"));
  });

  it("menerima Sub-CPMK baru yang induknya diperkenalkan usulan yang sama", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([
        butir({
          id: "b1",
          jenis: "CPMK_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: null,
          rumusan: "Mampu mengevaluasi skema basis data analitik.",
          cplKode: ["CPL08"],
        }),
        butir({
          id: "b2",
          jenis: "SUB_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: "CPMK083-1",
          rumusan: "Mahasiswa mampu membandingkan skema bintang dan skema ternormalisasi.",
        }),
      ]),
    );
    assert.deepEqual(temuan, []);
  });

  /**
   * Membebankan CPL baru pada mata kuliah adalah keputusan matriks CPL×MK —
   * di luar kewenangan usulan tingkat mata kuliah (doc 04 §2.2).
   */
  it("menolak peta ke CPL yang tidak dibebankan pada mata kuliahnya", () => {
    const k = kurikulum();
    k.cpl.push({ kode: "CPL09", deskripsi: "Mampu bekerja dalam tim lintas disiplin." });
    k.mataKuliah.push({
      kode: "TI999",
      nama: "Kerja Praktik",
      semester: 6,
      sksTeori: 2,
      sksPraktik: 0,
      cplKode: ["CPL09"],
      cpmk: [],
    });
    const temuan = periksaButir(
      k,
      usulan([
        butir({ jenis: "CPMK_PETA_CPL", subCpmkKode: null, cplKode: ["CPL09"] }),
      ]),
    );
    assert.ok(kode(temuan).includes("U-CPL-DILUAR-MK"));
  });

  it("membiarkan CATATAN_CPL lewat tanpa menuntut rujukan struktur", () => {
    const temuan = periksaButir(
      kurikulum(),
      usulan([
        butir({
          jenis: "CATATAN_CPL",
          cpmkKode: "CPMK081",
          subCpmkKode: null,
          rumusan: null,
          alasan: "Gudang data tidak tertampung capaian mana pun; perlu CPL baru.",
        }),
      ]),
    );
    assert.deepEqual(temuan, []);
  });
});

describe("terapkanKeInput — simulasi penerapan", () => {
  it("mengubah rumusan Sub-CPMK yang ditunjuk", () => {
    const hasil = terapkanKeInput(kurikulum(), usulan([butir()]));
    const sub = hasil.mataKuliah[0].cpmk[0].subCpmk[0];
    assert.match(sub.rumusan, /komponen sistem basis data/);
  });

  it("tidak mengubah kurikulum asal", () => {
    const asal = kurikulum();
    terapkanKeInput(asal, usulan([butir()]));
    assert.match(asal.mataKuliah[0].cpmk[0].subCpmk[0].rumusan, /konsep dasar/);
  });

  it("membuat CPMK baru lebih dulu, baru Sub-CPMK-nya", () => {
    const hasil = terapkanKeInput(
      kurikulum(),
      // Urutan sengaja dibalik: Sub-CPMK disebut sebelum induknya.
      usulan([
        butir({
          id: "b2",
          jenis: "SUB_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: "CPMK083-1",
          rumusan: "Mahasiswa mampu membandingkan skema bintang dan skema ternormalisasi.",
        }),
        butir({
          id: "b1",
          jenis: "CPMK_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: null,
          rumusan: "Mampu mengevaluasi skema basis data analitik.",
          cplKode: ["CPL08"],
        }),
      ]),
    );
    const baru = hasil.mataKuliah[0].cpmk.find((c) => c.kode === "CPMK083");
    assert.equal(baru?.subCpmk.length, 1);
    assert.equal(baru?.subCpmk[0].kode, "CPMK083-1");
  });

  it("membuang capaian yang dipensiunkan dari kurikulum hasil", () => {
    const hasil = terapkanKeInput(
      kurikulum(),
      usulan([
        butir({
          jenis: "SUB_PENSIUN",
          cpmkKode: "CPMK081",
          subCpmkKode: "CPMK081-1",
          rumusan: null,
        }),
      ]),
    );
    assert.equal(hasil.mataKuliah[0].cpmk[0].subCpmk.length, 0);
  });

  it("mengabaikan butir yang di luar kewenangan", () => {
    const hasil = terapkanKeInput(
      kurikulum(),
      usulan([butir({ jenis: "CATATAN_CPL", rumusan: "diabaikan" })]),
    );
    assert.deepEqual(hasil, kurikulum());
  });
});

describe("periksaAkibat — temuan yang dibawa usulan, bukan warisan", () => {
  /**
   * Penjaga utama modul ini. Kurikulum warisan hampir selalu sudah membawa
   * temuannya sendiri; kalau ikut ditampilkan, Kaprodi tidak bisa memisahkan
   * kesalahan pengusul dari kesalahan kurikulum lama.
   */
  it("tidak melaporkan temuan yang sudah ada sebelum usulan", () => {
    const k = kurikulum();
    // Cacat warisan: Sub-CPMK dengan kata kerja yang tidak dapat diamati.
    k.mataKuliah[0].cpmk[1].subCpmk[0].rumusan =
      "Mahasiswa memahami kebutuhan data pemangku kepentingan.";
    const temuan = periksaAkibat(k, usulan([butir()]));
    assert.deepEqual(temuan, []);
  });

  it("melaporkan Sub-CPMK yang melampaui level CPMK induknya", () => {
    const temuan = periksaAkibat(
      kurikulum(),
      usulan([
        butir({
          cpmkKode: "CPMK062",
          subCpmkKode: "CPMK062-1",
          rumusan: "Mahasiswa mampu merancang model data untuk kebutuhan pemangku kepentingan.",
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("K-SUB-LEVEL-LEBIH-TINGGI"));
  });

  /**
   * Akibat yang paling mudah terlewat kalau usulan hanya diperiksa per butir:
   * mempensiunkan CPMK terakhir yang menjabarkan sebuah CPL membuat CPL itu
   * dibebankan tetapi tidak pernah dinilai.
   */
  it("melaporkan CPL yang jadi tidak terjabarkan akibat pensiun", () => {
    const temuan = periksaAkibat(
      kurikulum(),
      usulan([
        butir({
          jenis: "CPMK_PENSIUN",
          cpmkKode: "CPMK062",
          subCpmkKode: null,
          rumusan: null,
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("K-MK-CPL-TIDAK-DIJABARKAN"));
  });

  it("menautkan temuan ke butir penyebabnya", () => {
    const temuan = periksaAkibat(
      kurikulum(),
      usulan([
        butir({
          id: "b7",
          cpmkKode: "CPMK062",
          subCpmkKode: "CPMK062-1",
          rumusan: "Mahasiswa mampu merancang model data untuk kebutuhan pemangku kepentingan.",
        }),
      ]),
    );
    assert.equal(temuan[0].butirId, "b7");
  });
});

describe("periksaJalurRalat", () => {
  const ralat = (ubah: Partial<ButirInput>) =>
    periksaJalurRalat(kurikulum(), usulan([butir(ubah)], { jalurRalat: true }));

  it("meloloskan perbaikan ejaan yang tidak menggeser makna", () => {
    assert.deepEqual(
      ralat({
        rumusan: "Mahasiswa mampu menjelaskan konsep dasar basis data relasionel.",
      }),
      [],
    );
  });

  it("menolak perubahan yang menggeser level Bloom rumusan", () => {
    const temuan = ralat({
      rumusan: "Mahasiswa mampu membandingkan konsep dasar basis data relasional.",
    });
    assert.ok(kode(temuan).includes("U-RALAT-GESER-BLOOM"));
  });

  it("menolak penulisan ulang yang melampaui ambang jarak sunting", () => {
    const temuan = ralat({
      rumusan:
        "Mahasiswa mampu menjelaskan model data, kunci, dan batasan integritas pada basis data.",
    });
    assert.ok(kode(temuan).includes("U-RALAT-TERLALU-JAUH"));
  });

  it("menolak jenis butir selain perbaikan rumusan", () => {
    const temuan = ralat({
      jenis: "SUB_PENSIUN",
      rumusan: null,
    });
    assert.ok(kode(temuan).includes("U-RALAT-JENIS-SALAH"));
  });

  it("tidak berlaku bila usulan tidak mengaku ralat", () => {
    assert.deepEqual(
      periksaJalurRalat(
        kurikulum(),
        usulan([butir({ jenis: "SUB_PENSIUN", rumusan: null })]),
      ),
      [],
    );
  });
});

describe("keputusan per butir", () => {
  it("hanya menghitung butir yang diterima atau disesuaikan", () => {
    const daftar = [
      butir({ id: "b1", status: "DITERIMA" }),
      butir({ id: "b2", status: "DITOLAK" }),
      butir({ id: "b3", status: "BARU" }),
      butir({ id: "b4", jenis: "CATATAN_CPL", status: "DITERIMA", rumusan: null }),
    ];
    assert.deepEqual(butirDipakai(daftar).map((b) => b.id), ["b1"]);
  });

  it("menolak Sub-CPMK yang diterima sementara CPMK induknya ditolak", () => {
    const temuan = periksaKonsistensiKeputusan(
      usulan([
        butir({
          id: "b1",
          jenis: "CPMK_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: null,
          rumusan: "Mampu mengevaluasi skema basis data analitik.",
          cplKode: ["CPL08"],
          status: "DITOLAK",
        }),
        butir({
          id: "b2",
          jenis: "SUB_BARU",
          cpmkKode: "CPMK083",
          subCpmkKode: "CPMK083-1",
          rumusan: "Mahasiswa mampu membandingkan skema bintang dan skema ternormalisasi.",
          status: "DITERIMA",
        }),
      ]),
    );
    assert.ok(kode(temuan).includes("U-INDUK-DITOLAK"));
  });

  it("menolak pengesahan tanpa satu pun butir diterima", () => {
    const temuan = periksaKonsistensiKeputusan(
      usulan([butir({ status: "DITOLAK" })]),
    );
    assert.ok(kode(temuan).includes("U-TANPA-BUTIR-DITERIMA"));
  });

  it("membolehkan usulan yang isinya hanya catatan untuk Kaprodi", () => {
    const temuan = periksaKonsistensiKeputusan(
      usulan([butir({ jenis: "CATATAN_CPL", rumusan: null, status: "DITERIMA" })]),
    );
    assert.deepEqual(temuan, []);
  });

  it("menilai penerapan hanya atas butir yang diterima", () => {
    const hasil = periksaPenerapan(
      kurikulum(),
      usulan([
        butir({ id: "b1", status: "DITERIMA" }),
        // Ditolak, jadi akibat buruknya tidak boleh ikut memblokir.
        butir({
          id: "b2",
          jenis: "CPMK_PENSIUN",
          cpmkKode: "CPMK062",
          subCpmkKode: null,
          rumusan: null,
          status: "DITOLAK",
        }),
      ]),
    );
    assert.equal(hasil.lolos, true);
  });
});

describe("periksaUsulanRevisi", () => {
  it("meloloskan usulan yang rapi", () => {
    assert.equal(periksaUsulanRevisi(kurikulum(), usulan([butir()])).lolos, true);
  });

  /**
   * Bila rujukannya saja sudah salah, memeriksa akibat hanya menghasilkan
   * temuan turunan yang membingungkan pengusul.
   */
  it("tidak menjalankan pemeriksaan akibat saat rujukan sudah salah", () => {
    const hasil = periksaUsulanRevisi(
      kurikulum(),
      usulan([butir({ subCpmkKode: "CPMK081-9" })]),
    );
    assert.deepEqual(kode(hasil.temuan), ["U-SUB-TIDAK-ADA"]);
  });
});

describe("ringkasPenerapan", () => {
  it("merangkum jenis perubahan yang diterapkan", () => {
    const ringkas = ringkasPenerapan("TI214", [
      butir({ id: "b1", status: "DITERIMA" }),
      butir({ id: "b2", status: "DISESUAIKAN" }),
      butir({
        id: "b3",
        jenis: "SUB_PENSIUN",
        rumusan: null,
        status: "DITERIMA",
      }),
    ]);
    assert.equal(ringkas, "TI214: 2 rumusan Sub-CPMK diubah, 1 Sub-CPMK dipensiunkan");
  });

  it("jujur saat tidak ada yang diterapkan", () => {
    assert.match(ringkasPenerapan("TI214", [butir({ status: "DITOLAK" })]), /tidak ada/);
  });
});

describe("jarakSunting", () => {
  it("nol untuk teks yang sama", () => {
    assert.equal(jarakSunting("basis data", "basis data"), 0);
  });

  it("menghitung sisipan, hapusan, dan penggantian", () => {
    assert.equal(jarakSunting("relasional", "relasionel"), 1);
    assert.equal(jarakSunting("data", "data "), 0);
    assert.equal(jarakSunting("kunci", "kunci utama"), 6);
  });
});
