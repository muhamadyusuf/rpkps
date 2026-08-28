import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaKelayakanArsip,
  periksaKelayakanHapus,
  statusSetelahPulih,
  type SensusRpkps,
} from "./daur-hidup";

const bersih: SensusRpkps = { status: "DRAF", jumlahSnapshot: 0, kelas: [] };

describe("kelayakan hapus RPKPS", () => {
  it("draf tanpa akibat boleh dihapus", () => {
    assert.deepEqual(periksaKelayakanHapus(bersih), { boleh: true, alasan: [] });
  });

  it("draf yang dikembalikan untuk revisi juga boleh dihapus", () => {
    assert.equal(periksaKelayakanHapus({ ...bersih, status: "DIREVISI" }).boleh, true);
  });

  it("kelas kosong tidak menghalangi", () => {
    const hasil = periksaKelayakanHapus({
      ...bersih,
      kelas: [{ kode: "A", jumlahPeserta: 0, jumlahNilai: 0, adaEvaluasi: false }],
    });
    assert.equal(hasil.boleh, true);
  });

  it("RPKPS terbit tidak boleh dihapus", () => {
    const hasil = periksaKelayakanHapus({ ...bersih, status: "TERBIT" });
    assert.equal(hasil.boleh, false);
    assert.match(hasil.alasan.join(" "), /diarsipkan/);
  });

  it("salinan beku menghalangi meski status sudah kembali draf", () => {
    const hasil = periksaKelayakanHapus({ ...bersih, jumlahSnapshot: 2 });
    assert.equal(hasil.boleh, false);
    assert.match(hasil.alasan.join(" "), /SHA-256/);
  });

  it("kelas berisi nilai menghalangi, dan angkanya disebut", () => {
    const hasil = periksaKelayakanHapus({
      ...bersih,
      kelas: [{ kode: "B", jumlahPeserta: 31, jumlahNilai: 124, adaEvaluasi: true }],
    });
    assert.equal(hasil.boleh, false);
    assert.match(hasil.alasan.join(" "), /B \(31 peserta, 124 nilai, evaluasi capaian\)/);
  });

  it("peserta tanpa nilai pun sudah menghalangi", () => {
    const hasil = periksaKelayakanHapus({
      ...bersih,
      kelas: [{ kode: "A", jumlahPeserta: 5, jumlahNilai: 0, adaEvaluasi: false }],
    });
    assert.equal(hasil.boleh, false);
  });

  it("seluruh penghalang dilaporkan sekaligus, bukan satu per satu", () => {
    const hasil = periksaKelayakanHapus({
      status: "TERBIT",
      jumlahSnapshot: 1,
      kelas: [{ kode: "A", jumlahPeserta: 30, jumlahNilai: 90, adaEvaluasi: false }],
    });
    assert.equal(hasil.alasan.length, 3);
  });

  it("pengajuan yang menggantung diarahkan untuk ditarik lebih dulu", () => {
    const hasil = periksaKelayakanHapus({ ...bersih, status: "DIAJUKAN" });
    assert.match(hasil.alasan.join(" "), /Tarik pengajuannya/);
  });
});

describe("kelayakan arsip", () => {
  it("RPKPS terbit boleh diarsipkan — inilah jalur penarikan", () => {
    assert.equal(periksaKelayakanArsip("TERBIT").boleh, true);
  });

  it("yang sudah diarsipkan tidak diarsipkan dua kali", () => {
    assert.equal(periksaKelayakanArsip("ARSIP").boleh, false);
  });

  it("yang sedang diajukan tidak boleh diarsipkan diam-diam", () => {
    assert.equal(periksaKelayakanArsip("DIAJUKAN").boleh, false);
  });
});

describe("pemulihan dari arsip", () => {
  it("yang pernah disahkan kembali terbit", () => {
    assert.equal(statusSetelahPulih(true), "TERBIT");
  });

  it("yang tidak pernah disahkan kembali menjadi draf", () => {
    assert.equal(statusSetelahPulih(false), "DRAF");
  });
});
