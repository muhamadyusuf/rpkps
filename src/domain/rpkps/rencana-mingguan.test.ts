import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BARIS_BARU,
  geserRujukan,
  hitungDampakStruktur,
  kodeMenganggur,
  pemetaanKodeAsesmen,
  periksaKelayakanUbahStruktur,
  susunRencanaStruktur,
  type BarisMingguan,
} from "./rencana-mingguan";

/** Tabel ringkas: 4 baris efektif, minggu 3 adalah UTS. */
const tabel: BarisMingguan[] = [
  { id: "a", minggu: 1, jenis: "EFEKTIF", bobot: 10 },
  { id: "b", minggu: 2, jenis: "EFEKTIF", bobot: 20 },
  { id: "c", minggu: 3, jenis: "UTS", bobot: 30 },
  { id: "d", minggu: 4, jenis: "EFEKTIF", bobot: 40 },
];

const nomor = (daftar: BarisMingguan[]) =>
  daftar.map((b) => `${b.id}${b.minggu}`).join(" ");

describe("tambah pertemuan", () => {
  it("baris baru mendarat di akhir tanpa menomori ulang apa pun", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "TAMBAH" });
    assert.equal(r.galat, null);
    assert.equal(r.nomorBaru, 5);
    assert.deepEqual(r.pemetaan, []);
    assert.equal(nomor(r.sesudah), `a1 b2 c3 d4 ${BARIS_BARU}5`);
  });

  it("tabel kosong mendapat minggu 1", () => {
    assert.equal(susunRencanaStruktur([], { jenis: "TAMBAH" }).nomorBaru, 1);
  });
});

describe("sisip pertemuan", () => {
  it("baris setelahnya naik satu, dan hanya baris itu yang dipetakan", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 2 });
    assert.equal(r.nomorBaru, 3);
    assert.deepEqual(r.pemetaan, [
      { id: "c", dari: 3, ke: 4 },
      { id: "d", dari: 4, ke: 5 },
    ]);
    assert.equal(nomor(r.sesudah), `a1 b2 ${BARIS_BARU}3 c4 d5`);
  });

  it("sisip di paling depan memakai setelah = 0", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 0 });
    assert.equal(r.nomorBaru, 1);
    assert.equal(r.pemetaan.length, 4);
    assert.equal(nomor(r.sesudah), `${BARIS_BARU}1 a2 b3 c4 d5`);
  });

  it("menolak posisi yang tidak ada", () => {
    assert.match(
      susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 9 }).galat ?? "",
      /tidak ada/,
    );
  });
});

describe("hapus pertemuan", () => {
  it("baris di bawahnya turun satu", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "HAPUS", minggu: 2 });
    assert.equal(r.idDihapus, "b");
    assert.deepEqual(r.pemetaan, [
      { id: "c", dari: 3, ke: 2 },
      { id: "d", dari: 4, ke: 3 },
    ]);
    assert.equal(nomor(r.sesudah), "a1 c2 d3");
  });

  it("menghapus baris terakhir tidak menomori ulang apa pun", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "HAPUS", minggu: 4 });
    assert.deepEqual(r.pemetaan, []);
    assert.equal(nomor(r.sesudah), "a1 b2 c3");
  });

  it("baris terakhir yang tersisa tidak boleh dihapus", () => {
    const r = susunRencanaStruktur([tabel[0]], { jenis: "HAPUS", minggu: 1 });
    assert.match(r.galat ?? "", /tidak boleh kosong/);
  });
});

describe("geser pertemuan", () => {
  it("menukar nomor dengan tetangganya, bukan isinya", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "GESER", minggu: 3, arah: "NAIK" });
    assert.deepEqual(r.pemetaan, [
      { id: "c", dari: 3, ke: 2 },
      { id: "b", dari: 2, ke: 3 },
    ]);
    assert.equal(nomor(r.sesudah), "a1 c2 b3 d4");
  });

  it("baris teratas tidak bisa naik lagi", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "GESER", minggu: 1, arah: "NAIK" });
    assert.match(r.galat ?? "", /paling awal/);
  });

  it("baris terbawah tidak bisa turun lagi", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "GESER", minggu: 4, arah: "TURUN" });
    assert.match(r.galat ?? "", /paling akhir/);
  });

  it("nomor yang berlubang tetap bertukar dengan tetangga terdekat", () => {
    const berlubang: BarisMingguan[] = [
      { id: "a", minggu: 1, jenis: "EFEKTIF", bobot: 0 },
      { id: "b", minggu: 7, jenis: "EFEKTIF", bobot: 0 },
    ];
    const r = susunRencanaStruktur(berlubang, { jenis: "GESER", minggu: 7, arah: "NAIK" });
    assert.equal(nomor(r.sesudah), "b1 a7");
  });
});

describe("rujukan minggu pada tugas dan linimasa", () => {
  it("mengikuti pemetaan bila nomornya bergeser", () => {
    const { pemetaan } = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 2 });
    assert.equal(geserRujukan(pemetaan, 3), 4);
    assert.equal(geserRujukan(pemetaan, 4), 5);
  });

  it("nomor yang tidak tersentuh dikembalikan apa adanya", () => {
    const { pemetaan } = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 2 });
    assert.equal(geserRujukan(pemetaan, 1), 1);
    assert.equal(geserRujukan(pemetaan, 16), 16);
  });
});

describe("perpindahan kode asesmen", () => {
  it("sisip memindahkan M3 ke M4, sedangkan UTS tetap UTS", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 1 });
    const peta = pemetaanKodeAsesmen(tabel, r.sesudah);
    // b: M2 → M3, d: M4 → M5. Baris c berjenis UTS, kodenya tidak ikut nomor.
    assert.deepEqual(peta, [
      { dari: "M2", ke: "M3" },
      { dari: "M4", ke: "M5" },
    ]);
  });

  it("baris tanpa bobot tidak punya kode, jadi tidak ikut berpindah", () => {
    const tanpaBobot: BarisMingguan[] = [
      { id: "a", minggu: 1, jenis: "EFEKTIF", bobot: 0 },
      { id: "b", minggu: 2, jenis: "EFEKTIF", bobot: 25 },
    ];
    const r = susunRencanaStruktur(tanpaBobot, { jenis: "SISIP", setelah: 0 });
    assert.deepEqual(pemetaanKodeAsesmen(tanpaBobot, r.sesudah), [
      { dari: "M2", ke: "M3" },
    ]);
  });

  it("mengubah jenis baris memindahkan M4 menjadi UAS", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "UBAH_JENIS", minggu: 4, ke: "UAS" });
    assert.deepEqual(pemetaanKodeAsesmen(tabel, r.sesudah), [
      { dari: "M4", ke: "UAS" },
    ]);
  });

  it("baris yang dihapus meninggalkan kodenya menganggur", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "HAPUS", minggu: 2 });
    assert.deepEqual(kodeMenganggur(tabel, r.sesudah), ["M2"]);
    // Sisanya tetap dipindahkan, bukan ikut dianggap hilang.
    assert.deepEqual(pemetaanKodeAsesmen(tabel, r.sesudah), [
      { dari: "M4", ke: "M3" },
    ]);
  });
});

describe("dampak terhadap nilai mahasiswa", () => {
  const nilai = { M1: 30, M2: 30, M4: 28, UTS: 31 };

  it("menyebut berapa nilai yang ikut berpindah", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 1 });
    const d = hitungDampakStruktur(tabel, r.sesudah, nilai);
    assert.deepEqual(d.berpindah, [
      { dari: "M2", ke: "M3", jumlah: 30 },
      { dari: "M4", ke: "M5", jumlah: 28 },
    ]);
    assert.equal(d.totalBerpindah, 58);
    assert.equal(d.totalMenganggur, 0);
  });

  it("menyebut berapa nilai yang menganggur setelah baris dihapus", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "HAPUS", minggu: 2 });
    const d = hitungDampakStruktur(tabel, r.sesudah, nilai);
    assert.deepEqual(d.menganggur, [{ kode: "M2", jumlah: 30 }]);
    assert.equal(d.totalMenganggur, 30);
    assert.equal(d.totalBerpindah, 28);
  });

  it("kode tanpa nilai tidak ikut dilaporkan", () => {
    const r = susunRencanaStruktur(tabel, { jenis: "SISIP", setelah: 1 });
    const d = hitungDampakStruktur(tabel, r.sesudah, {});
    assert.deepEqual(d.berpindah, []);
    assert.equal(d.totalBerpindah, 0);
  });
});

describe("kelayakan mengubah struktur", () => {
  it("draf dan draf revisi boleh", () => {
    assert.equal(periksaKelayakanUbahStruktur({ status: "DRAF" }).boleh, true);
    assert.equal(periksaKelayakanUbahStruktur({ status: "DIREVISI" }).boleh, true);
  });

  it("yang sedang diajukan ditolak dengan jalan keluarnya", () => {
    const h = periksaKelayakanUbahStruktur({ status: "DIAJUKAN" });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /Tarik pengajuannya/);
  });

  it("yang sudah terbit ditolak", () => {
    assert.equal(periksaKelayakanUbahStruktur({ status: "TERBIT" }).boleh, false);
  });
});
