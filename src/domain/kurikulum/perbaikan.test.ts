import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  konteksPerbaikan,
  periksaUsulan,
  temuanUntukAi,
  terapkanUsulan,
  type UsulanPerbaikan,
} from "./perbaikan";
import { validasiKurikulum } from "./validator";
import type { KurikulumInput, TemuanKurikulum } from "./tipe";

function kurikulum(): KurikulumInput {
  return {
    nama: "Kurikulum TI 2025",
    tahun: 2025,
    cpl: [
      { kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis dan sistematis." },
      { kode: "CPL08", deskripsi: "Mampu merancang solusi berbasis computing." },
      { kode: "CPL09", deskripsi: "Mampu bekerja dalam tim lintas disiplin." },
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
                rumusan: "Mahasiswa menguasai konsep dasar sistem basis data relasional.",
                levelBloom: "C2",
              },
            ],
          },
          {
            kode: "CPMK062",
            rumusan: "Mampu menganalisis kebutuhan data secara sistematis.",
            levelBloom: "C4",
            cplKode: ["CPL06"],
            subCpmk: [],
          },
        ],
      },
    ],
  };
}

function sub(k: KurikulumInput, kode: string) {
  return k.mataKuliah[0].cpmk.flatMap((c) => c.subCpmk).find((s) => s.kode === kode);
}

function usulanRumusan(ubah: Partial<UsulanPerbaikan> = {}): UsulanPerbaikan {
  return {
    id: "u1",
    jenis: "RUMUSAN_SUB",
    mkKode: "TI214",
    cpmkKode: "CPMK081",
    subCpmkKode: "CPMK081-1",
    kodeTemuan: ["K-SUB-TIDAK-TERUKUR"],
    alasan: "Kata menguasai tidak dapat diamati.",
    rumusan: "Mahasiswa mampu menjelaskan konsep dasar sistem basis data relasional.",
    levelBloom: "C2",
    ...ubah,
  };
}

describe("temuanUntukAi", () => {
  it("menyaring hanya temuan perumusan dan pemetaan", () => {
    const temuan: TemuanKurikulum[] = [
      { kode: "K-SUB-TIDAK-TERUKUR", tingkat: "PERINGATAN" },
      { kode: "K-CPMK-TANPA-SUB", tingkat: "PEMBLOKIR" },
      { kode: "K-MK-KODE-GANDA", tingkat: "PEMBLOKIR" },
      { kode: "K-MK-SKS-NOL", tingkat: "PEMBLOKIR" },
    ];

    assert.deepEqual(
      temuanUntukAi(temuan).map((t) => t.kode),
      ["K-SUB-TIDAK-TERUKUR", "K-CPMK-TANPA-SUB"],
    );
  });
});

describe("periksaUsulan — keluaran AI tidak dipercaya begitu saja", () => {
  it("menerima usulan yang menunjuk sasaran yang benar", () => {
    const { sah, ditolak } = periksaUsulan(kurikulum(), [usulanRumusan()]);
    assert.equal(sah.length, 1);
    assert.deepEqual(ditolak, []);
  });

  it("menolak usulan yang menunjuk mata kuliah tak dikenal", () => {
    const { sah, ditolak } = periksaUsulan(kurikulum(), [
      usulanRumusan({ mkKode: "TI999" }),
    ]);
    assert.equal(sah.length, 0);
    assert.match(ditolak[0].alasan, /TI999 tidak ada/);
  });

  it("menolak usulan yang menunjuk Sub-CPMK tak dikenal", () => {
    const { ditolak } = periksaUsulan(kurikulum(), [
      usulanRumusan({ subCpmkKode: "CPMK081-9" }),
    ]);
    assert.match(ditolak[0].alasan, /CPMK081-9 tidak ada/);
  });

  it("menolak rumusan usulan yang terlalu pendek untuk dinilai", () => {
    const { ditolak } = periksaUsulan(kurikulum(), [usulanRumusan({ rumusan: "Belajar." })]);
    assert.match(ditolak[0].alasan, /terlalu pendek/);
  });

  it("menolak CPL karangan yang tidak ada di kurikulum", () => {
    const { ditolak } = periksaUsulan(kurikulum(), [
      usulanRumusan({
        jenis: "PETA_CPL",
        subCpmkKode: undefined,
        cplKode: ["CPL06", "CPL99"],
      }),
    ]);
    assert.match(ditolak[0].alasan, /CPL99 tidak ada di daftar CPL/);
  });

  it("menolak CPL yang ada tetapi tidak dibebankan pada mata kuliahnya", () => {
    // CPL09 ada di kurikulum, tetapi TI214 hanya dibebani CPL06 dan CPL08.
    const { ditolak } = periksaUsulan(kurikulum(), [
      usulanRumusan({ jenis: "PETA_CPL", subCpmkKode: undefined, cplKode: ["CPL09"] }),
    ]);
    assert.match(ditolak[0].alasan, /CPL09 tidak dibebankan pada TI214/);
  });

  it("menolak Sub-CPMK baru yang kodenya sudah dipakai", () => {
    const { ditolak } = periksaUsulan(kurikulum(), [
      usulanRumusan({
        jenis: "SUB_BARU",
        subCpmkKode: undefined,
        subCpmkBaru: [
          {
            kode: "CPMK081-1",
            rumusan: "Mahasiswa mampu menjelaskan normalisasi hingga bentuk ketiga.",
            levelBloom: "C2",
          },
        ],
      }),
    ]);
    assert.match(ditolak[0].alasan, /CPMK081-1 sudah dipakai/);
  });
});

describe("terapkanUsulan", () => {
  it("mengganti rumusan Sub-CPMK dan menandainya berasal dari AI", () => {
    const awal = kurikulum();
    const hasil = terapkanUsulan(awal, [usulanRumusan()]);

    assert.match(sub(hasil, "CPMK081-1")!.rumusan, /menjelaskan/);
    assert.equal(sub(hasil, "CPMK081-1")!.sumberAi, true);
    // Kurikulum awal tidak ikut berubah.
    assert.match(sub(awal, "CPMK081-1")!.rumusan, /menguasai/);
    assert.equal(sub(awal, "CPMK081-1")!.sumberAi, undefined);
  });

  it("menambah Sub-CPMK baru pada CPMK yang belum punya", () => {
    const hasil = terapkanUsulan(kurikulum(), [
      usulanRumusan({
        jenis: "SUB_BARU",
        cpmkKode: "CPMK062",
        subCpmkKode: undefined,
        subCpmkBaru: [
          {
            kode: "CPMK062-1",
            rumusan: "Mahasiswa mampu menganalisis kebutuhan pengguna dari narasi kasus.",
            levelBloom: "C4",
          },
        ],
      }),
    ]);

    const cpmk = hasil.mataKuliah[0].cpmk.find((c) => c.kode === "CPMK062")!;
    assert.equal(cpmk.subCpmk.length, 1);
    assert.equal(cpmk.subCpmk[0].sumberAi, true);
  });

  it("mengganti seluruh pemetaan CPL, bukan menambahkan", () => {
    const hasil = terapkanUsulan(kurikulum(), [
      usulanRumusan({
        jenis: "PETA_CPL",
        cpmkKode: "CPMK062",
        subCpmkKode: undefined,
        cplKode: ["CPL06", "CPL08"],
      }),
    ]);

    const cpmk = hasil.mataKuliah[0].cpmk.find((c) => c.kode === "CPMK062")!;
    assert.deepEqual(cpmk.cplKode, ["CPL06", "CPL08"]);
  });

  it("mengabaikan usulan yang tidak menemukan sasarannya", () => {
    const awal = kurikulum();
    const hasil = terapkanUsulan(awal, [usulanRumusan({ mkKode: "TI999" })]);
    assert.deepEqual(hasil, awal);
  });

  it("benar-benar menghapus temuan yang dijawabnya", () => {
    const awal = kurikulum();
    const sebelum = validasiKurikulum(awal);
    assert.ok(
      sebelum.peringatan.some((t) => t.kode === "K-SUB-TIDAK-TERUKUR"),
      "kurikulum uji harus memuat temuan kata tidak terukur",
    );
    assert.ok(sebelum.pemblokir.some((t) => t.kode === "K-CPMK-TANPA-SUB"));

    const sesudah = validasiKurikulum(
      terapkanUsulan(awal, [
        usulanRumusan(),
        usulanRumusan({
          id: "u2",
          jenis: "SUB_BARU",
          cpmkKode: "CPMK062",
          subCpmkKode: undefined,
          subCpmkBaru: [
            {
              kode: "CPMK062-1",
              rumusan: "Mahasiswa mampu menganalisis kebutuhan pengguna dari narasi kasus.",
              levelBloom: "C4",
            },
          ],
        }),
      ]),
    );

    assert.equal(
      sesudah.peringatan.filter((t) => t.kode === "K-SUB-TIDAK-TERUKUR").length,
      0,
    );
    assert.equal(sesudah.pemblokir.filter((t) => t.kode === "K-CPMK-TANPA-SUB").length, 0);
  });
});

describe("konteksPerbaikan", () => {
  it("hanya mengirim mata kuliah yang punya temuan beserta CPL yang dipakainya", () => {
    const k = kurikulum();
    k.mataKuliah.push({
      kode: "TI310",
      nama: "Jaringan Komputer",
      semester: 3,
      sksTeori: 3,
      sksPraktik: 0,
      cplKode: ["CPL09"],
      cpmk: [],
    });

    const konteks = konteksPerbaikan(k, [
      { kode: "K-SUB-TIDAK-TERUKUR", tingkat: "PERINGATAN", pesan: "", lokasi: { mk: "TI214" } },
    ]);

    assert.equal(konteks.mataKuliah.length, 1);
    assert.deepEqual(
      konteks.cpl.map((c) => c.kode),
      ["CPL06", "CPL08"],
    );
  });
});
