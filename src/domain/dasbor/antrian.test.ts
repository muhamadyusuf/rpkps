import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  susunAntrian,
  SUMBER_KOSONG,
  TENGGAT_JALUR_KOSONG,
  type SumberAntrian,
} from "./antrian";
import { nilaiTenggat } from "../rpkps/tenggat";

function sumber(ubah: Partial<SumberAntrian> = {}): SumberAntrian {
  return { ...SUMBER_KOSONG, ...ubah };
}

describe("antrian kerja", () => {
  it("tidak menampilkan apa pun bila tidak ada yang menunggu", () => {
    assert.deepEqual(susunAntrian(sumber()), []);
  });

  it("membuang butir bernilai nol, bukan menampilkannya sebagai nol", () => {
    const a = susunAntrian(sumber({ rpkpsDraf: 2 }));
    assert.deepEqual(
      a.map((b) => b.kunci),
      ["rpkps-draf"],
    );
  });

  it("mendahulukan yang menghambat orang lain daripada pekerjaan sendiri", () => {
    const a = susunAntrian(
      sumber({
        rpkpsDraf: 5,
        temuanBelumDiverifikasi: 1,
        usulanMenungguKeputusan: 2,
      }),
    );
    assert.deepEqual(
      a.map((b) => b.kunci),
      ["usulan-menunggu", "temuan-belum-verifikasi", "rpkps-draf"],
    );
  });

  it("pekerjaan sendiri yang tertunda tidak pernah bernada bahaya", () => {
    const a = susunAntrian(sumber({ rpkpsDraf: 9 }));
    assert.equal(a[0].nada, "netral");
    assert.equal(a[0].kegentingan, "RENDAH");
  });

  it("kebijakan draf muncul sebagai satu butir, bukan hitungan", () => {
    const a = susunAntrian(sumber({ kebijakanMasihDraf: true }));
    assert.equal(a.length, 1);
    assert.equal(a[0].jumlah, 1);
    assert.equal(a[0].kegentingan, "TINGGI");
  });

  it("urutan antar butir segenting sama tetap tetap dan dapat diramalkan", () => {
    const a = susunAntrian(
      sumber({
        rpkpsDikembalikan: 1,
        rpkpsMenungguKeputusan: 1,
        kebijakanMasihDraf: true,
        usulanMenungguKeputusan: 1,
      }),
    );
    assert.deepEqual(
      a.map((b) => b.kunci),
      ["kebijakan-draf", "usulan-menunggu", "rpkps-menunggu", "rpkps-dikembalikan"],
    );
  });
});

describe("tenggat menaikkan kegentingan pekerjaan yang belum diajukan", () => {
  const sekarang = new Date("2026-08-30T09:00:00Z");
  const tenggatPada = (hari: number) =>
    nilaiTenggat({
      batas: new Date(sekarang.getTime() + hari * 86_400_000),
      sekarang,
      tahap: "PENYUSUNAN",
    });

  const jalur = (isi: Partial<typeof TENGGAT_JALUR_KOSONG>) => ({
    ...TENGGAT_JALUR_KOSONG,
    ...isi,
  });

  it("tanpa tenggat, draf tetap butir paling tenang", () => {
    const butir = susunAntrian({ ...SUMBER_KOSONG, rpkpsDraf: 2 })[0];
    assert.equal(butir.kegentingan, "RENDAH");
    assert.equal(butir.nada, "netral");
    assert.equal(butir.tenggat, null);
  });

  it("tenggat dekat menaikkan draf menjadi sedang dan membawa sisanya", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDraf: 2,
      tenggat: jalur({ penyusunan: tenggatPada(3) }),
    })[0];
    assert.equal(butir.kegentingan, "SEDANG");
    assert.equal(butir.tenggat?.hari, 3);
    assert.equal(butir.tenggat?.tingkat, "DEKAT");
  });

  it("tenggat lewat menjadikannya genting, sejajar pekerjaan yang menghambat orang lain", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDraf: 1,
      tenggat: jalur({ penyusunan: tenggatPada(-2) }),
    })[0];
    assert.equal(butir.kegentingan, "TINGGI");
    assert.equal(butir.nada, "bahaya");
    assert.equal(butir.tenggat?.hari, -2);
  });

  it("tenggat jauh tidak menurunkan kegentingan butir yang memang sudah tinggi", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDikembalikan: 1,
      tenggat: jalur({ penyusunan: tenggatPada(60) }),
    })[0];
    assert.equal(butir.kegentingan, "TINGGI");
  });

  /*
   * Inti P5 (docs/14 §4.1): tiga jalur, dan tiap butir hanya melihat jalurnya
   * sendiri. Tanpa pemisahan ini, keterlambatan dosen menyusun akan mewarnai
   * merah butir milik Kaprodi — menyalahkan orang atas keterlambatan orang
   * lain, persis yang ditolak §3.2.
   */
  it("tenggat penyusunan yang lewat tidak menyentuh butir milik pemutus", () => {
    const a = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsMenungguKeputusan: 1,
      rpkpsDraf: 1,
      tenggat: jalur({ penyusunan: tenggatPada(-9) }),
    });
    const putusan = a.find((b) => b.kunci === "rpkps-menunggu");
    assert.equal(putusan?.tenggat, null);
  });

  it("tiap jalur membawa tenggatnya sendiri", () => {
    const a = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsMenungguKeputusan: 1,
      rpkpsMenungguPengesahan: 1,
      rpkpsMenungguParaf: 1,
      tenggat: jalur({
        penyusunan: tenggatPada(2),
        review: tenggatPada(-1),
        pengesahan: tenggatPada(40),
      }),
    });
    const cari = (kunci: string) => a.find((b) => b.kunci === kunci);
    assert.equal(cari("rpkps-menunggu")?.tenggat?.hari, -1);
    assert.equal(cari("rpkps-pengesahan")?.tenggat?.hari, 40);
    assert.equal(cari("rpkps-paraf")?.tenggat?.hari, 2);
  });

  it("paraf yang tertahan muncul sebagai butirnya sendiri", () => {
    const a = susunAntrian({ ...SUMBER_KOSONG, rpkpsMenungguParaf: 3 });
    assert.deepEqual(
      a.map((b) => b.kunci),
      ["rpkps-paraf"],
    );
    assert.equal(a[0].jumlah, 3);
    // Bukan TINGGI tanpa sebab: yang tertahan baru satu langkah.
    assert.equal(a[0].kegentingan, "SEDANG");
  });
});

describe("dua cap terakhir punya antrian sendiri-sendiri", () => {
  it("pengesahan muncul sebagai butir tersendiri, bukan menumpang butir Kaprodi", () => {
    const a = susunAntrian({ ...SUMBER_KOSONG, rpkpsMenungguPengesahan: 3 });
    assert.deepEqual(a.map((b) => b.kunci), ["rpkps-pengesahan"]);
    assert.equal(a[0]!.jumlah, 3);
    assert.equal(a[0]!.kegentingan, "TINGGI");
  });

  it("keduanya dapat muncul bersamaan bagi orang yang memegang dua peran", () => {
    const a = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsMenungguKeputusan: 1,
      rpkpsMenungguPengesahan: 2,
    });
    assert.deepEqual(a.map((b) => b.kunci), ["rpkps-menunggu", "rpkps-pengesahan"]);
  });
});
