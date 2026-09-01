import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { susunAntrian, SUMBER_KOSONG, type SumberAntrian } from "./antrian";
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

  it("tanpa tenggat, draf tetap butir paling tenang", () => {
    const butir = susunAntrian({ ...SUMBER_KOSONG, rpkpsDraf: 2 })[0];
    assert.equal(butir.kegentingan, "RENDAH");
    assert.equal(butir.nada, "netral");
    assert.doesNotMatch(butir.rincian, /Tenggat/);
  });

  it("tenggat dekat menaikkan draf menjadi sedang dan menyebut sisanya", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDraf: 2,
      tenggat: tenggatPada(3),
    })[0];
    assert.equal(butir.kegentingan, "SEDANG");
    assert.match(butir.rincian, /tersisa 3 hari/);
  });

  it("tenggat lewat menjadikannya genting, sejajar pekerjaan yang menghambat orang lain", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDraf: 1,
      tenggat: tenggatPada(-2),
    })[0];
    assert.equal(butir.kegentingan, "TINGGI");
    assert.equal(butir.nada, "bahaya");
    assert.match(butir.rincian, /terlambat 2 hari/);
  });

  it("tenggat jauh tidak menurunkan kegentingan butir yang memang sudah tinggi", () => {
    const butir = susunAntrian({
      ...SUMBER_KOSONG,
      rpkpsDikembalikan: 1,
      tenggat: tenggatPada(60),
    })[0];
    assert.equal(butir.kegentingan, "TINGGI");
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
