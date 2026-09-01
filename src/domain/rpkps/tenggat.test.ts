import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bandingkanUrgensi,
  batasTahap,
  nilaiTenggat,
  nilaiTenggatDokumen,
  tahapTenggat,
  TENGGAT_KOSONG,
  type TenggatSemester,
} from "./tenggat";

const sekarang = new Date("2026-08-30T09:00:00Z");
const hari = (n: number) => new Date(sekarang.getTime() + n * 86_400_000);

const penyusunan = (batas: Date | null) =>
  nilaiTenggat({ batas, sekarang, tahap: "PENYUSUNAN" });

describe("nilai tenggat", () => {
  it("tanpa tenggat tidak menghasilkan desakan apa pun", () => {
    const n = penyusunan(null);
    assert.equal(n.tingkat, "TIDAK_ADA");
    assert.equal(n.hari, null);
  });

  it("jauh dari tenggat berstatus aman", () => {
    assert.equal(penyusunan(hari(30)).tingkat, "AMAN");
  });

  it("sepekan lagi sudah disebut dekat", () => {
    const n = penyusunan(hari(7));
    assert.equal(n.tingkat, "DEKAT");
    assert.equal(n.hari, 7);
  });

  it("lewat tenggat menghasilkan hari negatif dan label keterlambatan", () => {
    const n = penyusunan(hari(-3));
    assert.equal(n.tingkat, "LEWAT");
    assert.equal(n.hari, -3);
    assert.match(n.label, /terlambat 3 hari/);
  });

  it("terlambat beberapa jam disebut lewat hari ini, bukan terlambat 0 hari", () => {
    const n = penyusunan(new Date(sekarang.getTime() - 3 * 3_600_000));
    assert.equal(n.tingkat, "LEWAT");
    assert.match(n.label, /hari ini/);
  });

  it("label menyebut tahapnya, supaya tidak perlu membuka dokumen", () => {
    assert.match(nilaiTenggat({ batas: hari(-2), sekarang, tahap: "REVIEW" }).label, /^review /);
    assert.match(
      nilaiTenggat({ batas: hari(3), sekarang, tahap: "PENGESAHAN" }).label,
      /^pengesahan /,
    );
  });
});

describe("tahap mengikuti status", () => {
  it("draf dan yang dikembalikan masih tahap penyusunan", () => {
    assert.equal(tahapTenggat("DRAF"), "PENYUSUNAN");
    assert.equal(tahapTenggat("DIREVISI"), "PENYUSUNAN");
  });

  it("yang diajukan berpindah ke tahap review, bukan selesai", () => {
    assert.equal(tahapTenggat("DIAJUKAN"), "REVIEW");
  });

  it("yang disetujui Kaprodi menunggu pengesahan Penjaminan Mutu", () => {
    assert.equal(tahapTenggat("DISETUJUI"), "PENGESAHAN");
  });

  it("terbit dan arsip tidak lagi terikat tenggat apa pun", () => {
    assert.equal(tahapTenggat("TERBIT"), "SELESAI");
    assert.equal(tahapTenggat("ARSIP"), "SELESAI");
  });
});

describe("batas tahap dan jaminan hari bagi pemutus", () => {
  const tenggat: TenggatSemester = {
    penyusunan: hari(0),
    review: hari(10),
    pengesahan: hari(20),
  };

  it("penyusunan memakai tanggal semester apa adanya", () => {
    const b = batasTahap({ tahap: "PENYUSUNAN", tenggat, sejak: hari(-30), jaminanHari: 7 });
    assert.deepEqual(b, tenggat.penyusunan);
  });

  it("diajukan jauh sebelum tenggat: pemutus tetap terikat tanggal semester", () => {
    const b = batasTahap({ tahap: "REVIEW", tenggat, sejak: hari(-20), jaminanHari: 7 });
    assert.deepEqual(b, tenggat.review, "jaminan N hari adalah lantai, bukan langit-langit");
  });

  it("diajukan mepet: pemutus tetap mendapat N hari penuh", () => {
    const b = batasTahap({ tahap: "REVIEW", tenggat, sejak: hari(9), jaminanHari: 7 });
    assert.deepEqual(b, hari(16));
  });

  it("tahap pengesahan berhitung dari persetujuan Kaprodi, bukan dari pengajuan", () => {
    const b = batasTahap({ tahap: "PENGESAHAN", tenggat, sejak: hari(19), jaminanHari: 7 });
    assert.deepEqual(b, hari(26));
  });

  it("semester tanpa tenggat review tidak diberi tenggat karangan", () => {
    const b = batasTahap({
      tahap: "REVIEW",
      tenggat: { ...tenggat, review: null },
      sejak: hari(-1),
      jaminanHari: 7,
    });
    assert.equal(b, null);
  });

  it("belum ada cap waktu sampainya dokumen: tanggal semester yang berlaku", () => {
    const b = batasTahap({ tahap: "REVIEW", tenggat, sejak: null, jaminanHari: 7 });
    assert.deepEqual(b, tenggat.review);
  });
});

describe("penilaian utuh sebuah dokumen", () => {
  const tenggat: TenggatSemester = {
    penyusunan: hari(-5),
    review: hari(-1),
    pengesahan: hari(10),
  };
  const utuh = (
    status: Parameters<typeof nilaiTenggatDokumen>[0]["status"],
    lain?: Partial<Parameters<typeof nilaiTenggatDokumen>[0]>,
  ) =>
    nilaiTenggatDokumen({
      status,
      tenggat,
      diajukanPada: null,
      disetujuiPada: null,
      jaminanHari: 7,
      sekarang,
      ...lain,
    });

  it("dokumen yang diajukan TIDAK lagi dianggap selesai — desakannya berpindah", () => {
    const n = utuh("DIAJUKAN", { diajukanPada: hari(-20) });
    assert.equal(n.tahap, "REVIEW");
    assert.equal(n.tingkat, "LEWAT");
  });

  it("yang dikembalikan untuk revisi kembali terikat tenggat penyusunan", () => {
    const n = utuh("DIREVISI");
    assert.equal(n.tahap, "PENYUSUNAN");
    assert.equal(n.tingkat, "LEWAT");
  });

  it("cap waktu persetujuan tidak dipakai saat tahapnya masih review", () => {
    const n = utuh("DIAJUKAN", { diajukanPada: hari(-1), disetujuiPada: hari(-30) });
    assert.equal(n.tingkat, "DEKAT", "batas = diajukan + 7 hari");
    assert.equal(n.hari, 6);
  });

  it("dokumen terbit dan arsip tidak pernah mendesak", () => {
    for (const status of ["TERBIT", "ARSIP"] as const) {
      assert.equal(utuh(status).tingkat, "SELESAI");
    }
  });

  it("semester tanpa tenggat sama sekali tidak mendesak siapa pun", () => {
    const n = nilaiTenggatDokumen({
      status: "DRAF",
      tenggat: TENGGAT_KOSONG,
      diajukanPada: null,
      disetujuiPada: null,
      jaminanHari: 7,
      sekarang,
    });
    assert.equal(n.tingkat, "TIDAK_ADA");
  });
});

describe("urutan urgensi", () => {
  it("yang terlambat mendahului yang dekat, dan dekat mendahului aman", () => {
    const urut = [
      penyusunan(null),
      penyusunan(hari(30)),
      penyusunan(hari(-2)),
      penyusunan(hari(3)),
    ].sort(bandingkanUrgensi);
    assert.deepEqual(
      urut.map((n) => n.tingkat),
      ["LEWAT", "DEKAT", "AMAN", "TIDAK_ADA"],
    );
  });

  it("pada tingkat yang sama, yang lebih sedikit sisanya lebih dulu", () => {
    assert.ok(bandingkanUrgensi(penyusunan(hari(2)), penyusunan(hari(6))) < 0);
  });

  it("membandingkan lintas tahap tetap sah — antrian memuat keduanya", () => {
    const review = nilaiTenggat({ batas: hari(-1), sekarang, tahap: "REVIEW" });
    assert.ok(bandingkanUrgensi(review, penyusunan(hari(1))) < 0);
  });
});
