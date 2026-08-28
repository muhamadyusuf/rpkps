import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { susunAntrian, SUMBER_KOSONG, type SumberAntrian } from "./antrian";

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
