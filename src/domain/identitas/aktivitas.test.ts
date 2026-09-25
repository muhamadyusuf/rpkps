import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aktivitasParaf, aktivitasRiwayat, kunciRantai, type BarisRantai, type KonteksRpkps } from "./aktivitas";

const HARI = 86_400_000;
const t0 = new Date("2026-09-01T02:00:00.000Z");
const hari = (n: number) => new Date(t0.getTime() + n * HARI);

const konteks: KonteksRpkps = {
  judul: "RPKPS TI214 Basis Data 2026/2027-GANJIL",
  tenggat: { penyusunan: hari(10), review: hari(15), pengesahan: hari(20) },
  jaminanHari: 7,
  atribut: { prodi: "TI", ta: "2026/2027-GANJIL" },
};
const EMAIL: Record<string, string> = { koor: "koor@itts.ac.id", kaprodi: "kaprodi@itts.ac.id", pmi: "pmi@itts.ac.id", dosen: "dosen@itts.ac.id" };
const bersama = { konteks, email: (id: string) => EMAIL[id], awalan: "rpkps" };

let urut = 0;
const baris = (kunci: BarisRantai["kunci"], olehId: string, pada: Date, versi = 1): BarisRantai => ({
  id: `r${++urut}`,
  rpkpsId: "rp1",
  versi,
  kunci,
  olehId,
  pada,
});

function petakan(rantai: BarisRantai[]) {
  return rantai.flatMap((b) => aktivitasRiwayat({ ...bersama, baris: b, rantai }));
}

describe("kunci rantai", () => {
  it("dibaca dari data.kunci; peristiwa lain dan baris lama tanpa kunci diabaikan", () => {
    assert.equal(kunciRantai({ kunci: "DISETUJUI_KAPRODI", params: {} }), "DISETUJUI_KAPRODI");
    assert.equal(kunciRantai({ kunci: "DARI_ARSIP_TERBIT", params: {} }), null, "berstatus TERBIT tetapi bukan pengesahan");
    assert.equal(kunciRantai({ kunci: "DIBUAT_KOSONG" }), null);
    assert.equal(kunciRantai(null), null);
    assert.equal(kunciRantai("DISAHKAN_MUTU"), null);
  });
});

describe("aktivitas dari rantai pengesahan", () => {
  it("rantai lurus: diajukan → disetujui → disahkan + terbit tanpa revisi", () => {
    const rantai = [
      baris("DIPARAF_KOORDINATOR", "koor", hari(8)),
      baris("DISETUJUI_KAPRODI", "kaprodi", hari(9)),
      baris("DISAHKAN_MUTU", "pmi", hari(12)),
    ];
    const a = petakan(rantai);
    assert.deepEqual(
      a.map((x) => [x.jenis, x.pelaku.email]),
      [
        ["rpkps.diajukan", "koor@itts.ac.id"],
        ["rpkps.disetujui", "kaprodi@itts.ac.id"],
        ["rpkps.disahkan", "pmi@itts.ac.id"],
        ["rpkps.terbit", "koor@itts.ac.id"],
      ],
    );
    const [diajukan, disetujui, disahkan, terbit] = a;
    assert.equal(diajukan.tenggat, hari(10).toISOString(), "tenggat penyusunan");
    assert.equal(diajukan.diterimaPada, null);
    assert.equal(disetujui.diterimaPada, hari(8).toISOString(), "sampai di meja Kaprodi saat diajukan");
    assert.equal(disetujui.tenggat, hari(15).toISOString(), "masuk jauh-jauh hari: tetap tanggal semester");
    assert.equal(disahkan.diterimaPada, hari(9).toISOString());
    assert.equal(disahkan.tenggat, hari(20).toISOString());
    assert.equal(terbit.nilai, 0);
    assert.equal(terbit.id, `riwayat:${rantai[2].id}:terbit`);
    assert.deepEqual(diajukan.objek, { tipe: "rpkps", id: "rp1", judul: konteks.judul });
    assert.deepEqual(diajukan.atribut, { prodi: "TI", ta: "2026/2027-GANJIL", versi: 1 });
  });

  it("diajukan mepet: pemutus mendapat jaminan N hari sejak dokumen sampai (docs/14 §3.2)", () => {
    const rantai = [baris("DIPARAF_KOORDINATOR", "koor", hari(14)), baris("DISETUJUI_KAPRODI", "kaprodi", hari(18))];
    const [, disetujui] = petakan(rantai);
    assert.equal(disetujui.tenggat, hari(21).toISOString(), "14 + 7 hari melampaui tenggat review hari ke-15");
  });

  it("pengembalian dibedakan menurut siapa yang mengembalikan; terbit menghitung putaran revisi", () => {
    const rantai = [
      baris("DIPARAF_KOORDINATOR", "koor", hari(5), 1),
      baris("DIKEMBALIKAN_REVISI", "kaprodi", hari(6), 1),
      baris("DIPARAF_KOORDINATOR", "koor", hari(7), 2),
      baris("DISETUJUI_KAPRODI", "kaprodi", hari(8), 2),
      baris("DIKEMBALIKAN_REVISI", "pmi", hari(9), 2),
      baris("DIPARAF_KOORDINATOR", "koor", hari(11), 3),
      baris("DISETUJUI_KAPRODI", "kaprodi", hari(12), 3),
      baris("DISAHKAN_MUTU", "pmi", hari(13), 3),
    ];
    const a = petakan(rantai);
    const kaprodi = a.find((x) => x.jenis === "rpkps.dikembalikan_kaprodi")!;
    const pmi = a.find((x) => x.jenis === "rpkps.dikembalikan_pmi")!;
    assert.equal(kaprodi.pelaku.email, "kaprodi@itts.ac.id");
    assert.equal(kaprodi.diterimaPada, hari(5).toISOString());
    assert.equal(pmi.pelaku.email, "pmi@itts.ac.id");
    assert.equal(pmi.diterimaPada, hari(8).toISOString(), "sampai di PMI saat Kaprodi menyetujui ronde itu");
    const disetujui3 = a.filter((x) => x.jenis === "rpkps.disetujui").at(-1)!;
    assert.equal(disetujui3.diterimaPada, hari(11).toISOString(), "ronde 3 dihitung dari pengajuan ronde 3, bukan ronde 1");
    assert.equal(a.find((x) => x.jenis === "rpkps.terbit")!.nilai, 2);
    assert.equal(a.filter((x) => x.jenis === "rpkps.diajukan").length, 3);
  });

  it("tenggat semester kosong tidak diciptakan oleh jaminan N hari", () => {
    const tanpa = { ...konteks, tenggat: { penyusunan: null, review: null, pengesahan: null } };
    const rantai = [baris("DIPARAF_KOORDINATOR", "koor", hari(1)), baris("DISETUJUI_KAPRODI", "kaprodi", hari(2))];
    const a = rantai.flatMap((b) => aktivitasRiwayat({ ...bersama, konteks: tanpa, baris: b, rantai }));
    assert.deepEqual(a.map((x) => x.tenggat), [null, null]);
  });

  it("pelaku yang tidak lagi dikenal dilewati; pengembalian tanpa cap sebelumnya dilewati", () => {
    assert.deepEqual(petakan([baris("DIPARAF_KOORDINATOR", "hilang", hari(1))]), []);
    assert.deepEqual(petakan([baris("DIKEMBALIKAN_REVISI", "kaprodi", hari(1))]), []);
    const tanpaKoordinator = petakan([baris("DISETUJUI_KAPRODI", "kaprodi", hari(1)), baris("DISAHKAN_MUTU", "pmi", hari(2))]);
    assert.deepEqual(
      tanpaKoordinator.map((x) => x.jenis),
      ["rpkps.disetujui", "rpkps.disahkan"],
      "terbit tanpa koordinator yang tercatat tidak dilaporkan",
    );
  });
});

describe("aktivitas dari paraf", () => {
  const paraf = { id: "ttd1", rpkpsId: "rp1", versi: 2, penggunaId: "dosen", pada: hari(9) };

  it("waktu diminta = permintaan terakhir pada ronde yang sama; tanpa tenggat", () => {
    const [a] = aktivitasParaf({ ...bersama, paraf, diminta: [hari(2), hari(7), hari(8), hari(10)], dikembalikan: [hari(6)] });
    assert.equal(a.jenis, "rpkps.paraf_diberikan");
    assert.equal(a.id, "paraf:ttd1");
    assert.equal(a.pelaku.email, "dosen@itts.ac.id");
    assert.equal(a.diterimaPada, hari(8).toISOString(), "permintaan sesudah paraf tidak dihitung");
    assert.equal(a.tenggat, null);
    assert.equal(a.atribut.versi, 2);
  });

  it("permintaan dari ronde yang sudah dikembalikan tidak dihitung", () => {
    const [a] = aktivitasParaf({ ...bersama, paraf, diminta: [hari(2)], dikembalikan: [hari(6)] });
    assert.equal(a.diterimaPada, null);
  });
});
