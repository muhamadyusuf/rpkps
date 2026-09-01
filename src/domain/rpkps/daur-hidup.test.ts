import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaKelayakanArsip,
  periksaKelayakanHapus,
  ringkasAkibatHapus,
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

  it("yang menunggu pengesahan Penjaminan Mutu juga tertahan", () => {
    const h = periksaKelayakanArsip("DISETUJUI");
    assert.equal(h.boleh, false);
    assert.match(h.alasan[0]!, /Penjaminan Mutu/);
  });
});

describe("dokumen yang menunggu pengesahan", () => {
  it("tidak dapat dihapus, dan alasannya menyebut cap yang ditunggu", () => {
    const h = periksaKelayakanHapus({ ...bersih, status: "DISETUJUI" });
    assert.equal(h.boleh, false);
    assert.match(h.alasan[0]!, /Penjaminan Mutu/);
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

describe("akibat penghapusan paksa", () => {
  it("draf tanpa jejak tidak punya akibat apa pun", () => {
    assert.deepEqual(ringkasAkibatHapus(bersih), { rincian: [], merusakJejak: false });
  });

  it("dokumen terbit menyebut salinan beku DAN halaman publiknya", () => {
    const akibat = ringkasAkibatHapus({ ...bersih, status: "TERBIT", jumlahSnapshot: 2 });
    assert.equal(akibat.merusakJejak, true);
    assert.match(akibat.rincian.join(" "), /2 salinan beku/);
    assert.match(akibat.rincian.join(" "), /404/);
  });

  it("kelas berjejak disebut lengkap dengan angkanya", () => {
    const akibat = ringkasAkibatHapus({
      ...bersih,
      kelas: [{ kode: "B", jumlahPeserta: 31, jumlahNilai: 124, adaEvaluasi: true }],
    });
    assert.equal(akibat.merusakJejak, true);
    assert.match(akibat.rincian.join(" "), /B \(31 peserta, 124 nilai, evaluasi capaian\)/);
  });

  it("kelas kosong bukan jejak — sama seperti pada jalur hapus biasa", () => {
    const akibat = ringkasAkibatHapus({
      ...bersih,
      kelas: [{ kode: "A", jumlahPeserta: 0, jumlahNilai: 0, adaEvaluasi: false }],
    });
    assert.deepEqual(akibat, { rincian: [], merusakJejak: false });
  });

  it("pengajuan yang menggantung disebut, tetapi bukan kerusakan jejak", () => {
    const akibat = ringkasAkibatHapus({ ...bersih, status: "DISETUJUI" });
    assert.equal(akibat.merusakJejak, false);
    assert.match(akibat.rincian.join(" "), /rantai pengesahan/);
  });

  it("seluruh akibat dilaporkan sekaligus", () => {
    const akibat = ringkasAkibatHapus({
      status: "TERBIT",
      jumlahSnapshot: 1,
      kelas: [{ kode: "A", jumlahPeserta: 30, jumlahNilai: 90, adaEvaluasi: false }],
    });
    assert.equal(akibat.rincian.length, 3);
  });
});
