import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bolehSuntingKurikulum,
  geserUrutan,
  normalkanKode,
  periksaKelayakanHapusCpl,
  periksaKelayakanHapusCpmk,
  periksaKelayakanHapusMk,
  periksaKelayakanHapusSubCpmk,
  periksaKelayakanUbahMk,
  type RpkpsPenggantung,
  type SensusSubCpmk,
} from "./sunting";

const drafBaru: RpkpsPenggantung = {
  label: "TI214 · 2025/2026 Ganjil",
  status: "DRAF",
  jumlahSnapshot: 0,
};

const sudahTerbit: RpkpsPenggantung = {
  label: "TI214 · 2024/2025 Genap",
  status: "TERBIT",
  jumlahSnapshot: 2,
};

const subBersih: SensusSubCpmk = {
  kode: "CPMK081-1",
  jumlahPertemuan: 0,
  jumlahTugas: 0,
  jumlahButirKisiKisi: 0,
};

describe("bolehSuntingKurikulum", () => {
  it("mengizinkan DRAF", () => {
    const h = bolehSuntingKurikulum("DRAF");
    assert.equal(h.boleh, true);
    assert.deepEqual(h.alasan, []);
  });

  it("menolak BERLAKU dan mengarahkan ke usulan revisi", () => {
    const h = bolehSuntingKurikulum("BERLAKU");
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /Usulan Revisi Kurikulum/);
  });

  it("menolak ARSIP", () => {
    assert.equal(bolehSuntingKurikulum("ARSIP").boleh, false);
  });
});

describe("periksaKelayakanHapusMk", () => {
  it("mengizinkan mata kuliah tanpa RPKPS", () => {
    assert.equal(periksaKelayakanHapusMk({ kode: "TI214", rpkps: [] }).boleh, true);
  });

  it("menolak meski RPKPS-nya baru berstatus draf", () => {
    // Tidak ada ambang: cascade MataKuliah menjangkau kelas, peserta, dan
    // nilai — draf pun sudah dapat memuat ketiganya.
    const h = periksaKelayakanHapusMk({ kode: "TI214", rpkps: [drafBaru] });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /TI214/);
  });

  it("menyebut jumlah salinan beku pada penolakannya", () => {
    const h = periksaKelayakanHapusMk({ kode: "TI214", rpkps: [sudahTerbit] });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /2 salinan beku/);
    assert.match(h.alasan.join(" "), /SHA-256/);
  });
});

describe("periksaKelayakanUbahMk", () => {
  it("mengizinkan selama belum ada dokumen yang disahkan", () => {
    // Beda dengan hapus: yang rusak sidik dokumen, dan draf belum
    // menandatangani apa pun.
    const h = periksaKelayakanUbahMk({ kode: "TI214", rpkps: [drafBaru] });
    assert.equal(h.boleh, true);
  });

  it("menolak bila sudah ada salinan beku", () => {
    const h = periksaKelayakanUbahMk({ kode: "TI214", rpkps: [drafBaru, sudahTerbit] });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /2024\/2025 Genap/);
  });
});

describe("periksaKelayakanHapusSubCpmk", () => {
  it("mengizinkan Sub-CPMK yang belum dirujuk", () => {
    assert.equal(periksaKelayakanHapusSubCpmk(subBersih).boleh, true);
  });

  it("menolak dan merinci setiap jenis rujukan", () => {
    const h = periksaKelayakanHapusSubCpmk({
      kode: "CPMK081-1",
      jumlahPertemuan: 3,
      jumlahTugas: 1,
      jumlahButirKisiKisi: 2,
    });
    assert.equal(h.boleh, false);
    const pesan = h.alasan.join(" ");
    assert.match(pesan, /3 baris mingguan/);
    assert.match(pesan, /1 lembar tugas/);
    assert.match(pesan, /2 butir kisi-kisi/);
  });

  it("tidak menyebut jenis rujukan yang nol", () => {
    const h = periksaKelayakanHapusSubCpmk({ ...subBersih, jumlahPertemuan: 2 });
    assert.equal(h.boleh, false);
    assert.doesNotMatch(h.alasan.join(" "), /lembar tugas|kisi-kisi/);
  });
});

describe("periksaKelayakanHapusCpmk", () => {
  it("mengizinkan CPMK bersih tanpa RPKPS", () => {
    const h = periksaKelayakanHapusCpmk({
      kode: "CPMK081",
      subCpmk: [subBersih],
      rpkps: [],
    });
    assert.equal(h.boleh, true);
  });

  it("mewarisi penolakan dari Sub-CPMK di bawahnya", () => {
    // Cascade CPMK → SubCpmk → pertemuan: anaknya yang terpakai adalah
    // alasan induknya tidak boleh dihapus.
    const h = periksaKelayakanHapusCpmk({
      kode: "CPMK081",
      subCpmk: [subBersih, { ...subBersih, kode: "CPMK081-2", jumlahPertemuan: 4 }],
      rpkps: [],
    });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /CPMK081-2/);
    assert.match(h.alasan.join(" "), /dipensiunkan/);
  });

  it("mengumpulkan SEMUA alasan, bukan yang pertama saja", () => {
    const h = periksaKelayakanHapusCpmk({
      kode: "CPMK081",
      subCpmk: [{ ...subBersih, jumlahTugas: 1 }],
      rpkps: [sudahTerbit],
    });
    assert.equal(h.boleh, false);
    assert.equal(h.alasan.length, 2);
  });
});

describe("periksaKelayakanHapusCpl", () => {
  it("mengizinkan CPL yatim", () => {
    const h = periksaKelayakanHapusCpl({ kode: "CPL06", rpkps: [], jumlahCpmk: 0 });
    assert.equal(h.boleh, true);
  });

  it("menolak CPL yang masih dijabarkan CPMK", () => {
    const h = periksaKelayakanHapusCpl({ kode: "CPL06", rpkps: [], jumlahCpmk: 3 });
    assert.equal(h.boleh, false);
    assert.match(h.alasan.join(" "), /3 CPMK/);
  });
});

describe("normalkanKode", () => {
  it("membesarkan huruf dan merapatkan spasi", () => {
    assert.equal(normalkanKode(" cpmk 081 "), "CPMK081");
  });

  it("menyamakan dua tulisan yang hanya beda huruf besar-kecil", () => {
    // @@unique peka huruf besar-kecil: tanpa ini "cpmk081" dan "CPMK081"
    // lolos sebagai dua baris berbeda.
    assert.equal(normalkanKode("cpmk081"), normalkanKode("CPMK081"));
  });
});

describe("geserUrutan", () => {
  const daftar = [
    { id: "a", urutan: 0 },
    { id: "b", urutan: 1 },
    { id: "c", urutan: 2 },
  ];

  it("menukar dengan tetangga di atasnya", () => {
    assert.deepEqual(geserUrutan(daftar, "b", "naik"), [
      { id: "b", urutan: 0 },
      { id: "a", urutan: 1 },
      { id: "c", urutan: 2 },
    ]);
  });

  it("menukar dengan tetangga di bawahnya", () => {
    assert.deepEqual(geserUrutan(daftar, "b", "turun"), [
      { id: "a", urutan: 0 },
      { id: "c", urutan: 1 },
      { id: "b", urutan: 2 },
    ]);
  });

  it("mengembalikan null di ujung daftar", () => {
    assert.equal(geserUrutan(daftar, "a", "naik"), null);
    assert.equal(geserUrutan(daftar, "c", "turun"), null);
  });

  it("mengembalikan null untuk id yang tidak ada", () => {
    assert.equal(geserUrutan(daftar, "z", "naik"), null);
  });

  it("merapatkan urutan yang berlubang", () => {
    // Hasil penghapusan berulang: 0, 5, 9. Tetap harus jadi 0, 1, 2.
    const berlubang = [
      { id: "a", urutan: 0 },
      { id: "b", urutan: 5 },
      { id: "c", urutan: 9 },
    ];
    assert.deepEqual(geserUrutan(berlubang, "c", "naik"), [
      { id: "a", urutan: 0 },
      { id: "c", urutan: 1 },
      { id: "b", urutan: 2 },
    ]);
  });

  it("mengurutkan dari nilai urutan, bukan dari posisi array", () => {
    const acak = [
      { id: "c", urutan: 2 },
      { id: "a", urutan: 0 },
      { id: "b", urutan: 1 },
    ];
    assert.deepEqual(geserUrutan(acak, "a", "turun"), [
      { id: "b", urutan: 0 },
      { id: "a", urutan: 1 },
      { id: "c", urutan: 2 },
    ]);
  });
});
