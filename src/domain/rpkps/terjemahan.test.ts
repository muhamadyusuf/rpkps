import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hitungKelengkapan,
  medanBelumDiterjemahkan,
  medanKurang,
  saringHasilTerjemahan,
  susunAlamat,
  uraiAlamat,
} from "./terjemahan";

describe("kelengkapan terjemahan", () => {
  it("hanya menghitung medan yang ada isinya", () => {
    // Topik kosong bukan pekerjaan terjemahan yang tertinggal — ia memang
    // tidak ada, dan memasukkannya ke penyebut membuat angkanya berbohong.
    const h = hitungKelengkapan([
      { asal: "Basis data", terjemahan: "Databases" },
      { asal: "", terjemahan: "" },
      { asal: null, terjemahan: null },
    ]);
    assert.deepEqual(h, { terisi: 1, total: 1, persen: 100, sebagian: false });
  });

  it("spasi kosong dihitung belum diterjemahkan", () => {
    const h = hitungKelengkapan([{ asal: "Basis data", terjemahan: "   " }]);
    assert.equal(h.terisi, 0);
    assert.equal(h.persen, 0);
  });

  it("menandai terjemahan yang dimulai tetapi belum selesai", () => {
    const h = hitungKelengkapan([
      { asal: "a", terjemahan: "a-en" },
      { asal: "b", terjemahan: null },
    ]);
    assert.equal(h.sebagian, true);
    assert.equal(h.persen, 50);
  });

  it("dokumen tanpa terjemahan sama sekali bukan 'sebagian'", () => {
    // Dokumen yang seluruhnya Indonesia adalah keadaan normal, bukan pekerjaan
    // separuh jalan. Membedakan keduanya yang membuat peringatan W8 berguna.
    const h = hitungKelengkapan([{ asal: "a", terjemahan: null }]);
    assert.equal(h.sebagian, false);
    assert.equal(h.total, 1);
  });

  it("dokumen kosong tidak membagi dengan nol", () => {
    assert.deepEqual(hitungKelengkapan([]), {
      terisi: 0,
      total: 0,
      persen: 0,
      sebagian: false,
    });
  });
});

describe("saring hasil terjemahan", () => {
  const diminta = [
    { alamat: "rpkps:r1:deskripsiEn", label: "Deskripsi", asal: "Basis data", terjemahan: null },
    { alamat: "pertemuan:p1:topikEn", label: "Minggu 1", asal: "Pengantar", terjemahan: null },
  ];

  it("menerima alamat yang memang diminta", () => {
    const h = saringHasilTerjemahan(diminta, [
      { alamat: "pertemuan:p1:topikEn", teks: "Introduction" },
    ]);
    assert.deepEqual(h.diterima, [{ alamat: "pertemuan:p1:topikEn", teks: "Introduction" }]);
    assert.deepEqual(h.ditolak, []);
  });

  it("menolak alamat yang tidak pernah dikirim", () => {
    // Model boleh mengarang, dan dosen boleh menyunting di tab lain selama
    // permintaan berjalan. Menulisnya begitu saja berarti menulis ke baris
    // yang tidak dimaksudkan siapa pun.
    const h = saringHasilTerjemahan(diminta, [{ alamat: "tugas:t9:namaEn", teks: "X" }]);
    assert.deepEqual(h.diterima, []);
    assert.deepEqual(h.ditolak, ["tugas:t9:namaEn"]);
  });

  it("menolak alamat berulang dan teks kosong", () => {
    const h = saringHasilTerjemahan(diminta, [
      { alamat: "pertemuan:p1:topikEn", teks: "Introduction" },
      { alamat: "pertemuan:p1:topikEn", teks: "Intro" },
      { alamat: "rpkps:r1:deskripsiEn", teks: "   " },
    ]);
    assert.equal(h.diterima.length, 1);
    assert.deepEqual(h.ditolak, ["pertemuan:p1:topikEn", "rpkps:r1:deskripsiEn"]);
  });

  it("hanya medan berisi dan belum diterjemahkan yang dikirim", () => {
    const semua = [
      ...diminta,
      { alamat: "a", label: "a", asal: "", terjemahan: null },
      { alamat: "b", label: "b", asal: "ada", terjemahan: "already" },
    ];
    assert.deepEqual(
      medanBelumDiterjemahkan(semua).map((m) => m.alamat),
      ["rpkps:r1:deskripsiEn", "pertemuan:p1:topikEn"],
    );
  });
});

describe("alamat medan", () => {
  it("kolom biasa bolak-balik utuh", () => {
    const alamat = susunAlamat("pertemuan", "p1", "topikEn");
    assert.equal(alamat, "pertemuan:p1:topikEn");
    assert.deepEqual(uraiAlamat(alamat), {
      model: "pertemuan",
      id: "p1",
      medan: "topikEn",
      indeks: null,
    });
  });

  it("elemen larik membawa indeksnya", () => {
    // Tanpa indeks, `subtopik` dan `rincian` tidak dapat ditunjuk sama sekali —
    // dan itulah yang dulu membuat kelengkapan mentok di bawah 100%.
    const alamat = susunAlamat("kriteriaTugas", "kr1", "rincianEn", 2);
    assert.equal(alamat, "kriteriaTugas:kr1:rincianEn#2");
    assert.deepEqual(uraiAlamat(alamat), {
      model: "kriteriaTugas",
      id: "kr1",
      medan: "rincianEn",
      indeks: 2,
    });
  });

  it("indeks nol bukan ketiadaan indeks", () => {
    // `indeks == null` dan `indeks === 0` menempuh jalur tulis yang BERBEDA:
    // yang satu kolom teks, yang satu larik. Menyamakannya menulis string
    // tunggal ke kolom `text[]`.
    assert.equal(uraiAlamat("pertemuan:p1:subtopikEn#0")?.indeks, 0);
  });

  it("bentuk yang tidak dikenali dibuang, bukan ditebak", () => {
    // Alamat datang dari peramban.
    for (const buruk of [
      "pertemuan:p1",
      "pertemuan:p1:topikEn:lagi",
      "pertemuan:p1:subtopikEn#",
      "pertemuan:p1:subtopikEn#dua",
      "pertemuan:p1:subtopikEn#-1",
      "pertemuan:p1:#2",
      ":p1:topikEn",
    ]) {
      assert.equal(uraiAlamat(buruk), null, `${buruk} lolos`);
    }
  });
});

describe("ronde ulang", () => {
  const medan = [
    { alamat: "a", label: "a", asal: "satu", terjemahan: null },
    { alamat: "b", label: "b", asal: "dua", terjemahan: null },
    { alamat: "c", label: "c", asal: "tiga", terjemahan: null },
  ];

  it("yang tidak dijawab model dikembalikan untuk dikirim ulang", () => {
    // Sebuah model yang menjatuhkan medan menghasilkan jawaban yang SAH menurut
    // skema, hanya lebih pendek. Tanpa langkah ini kekurangannya tidak pernah
    // terlihat sampai dosen membuka angka kelengkapan.
    assert.deepEqual(
      medanKurang(medan, new Set(["b"])).map((m) => m.alamat),
      ["a", "c"],
    );
  });

  it("kosong bila semuanya terjawab", () => {
    assert.deepEqual(medanKurang(medan, new Set(["a", "b", "c"])), []);
  });
});
