import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KonteksDraf } from "./draf";
import {
  BATAS_TEMPLAT,
  bacaAngka,
  bersihkanSel,
  normalisasiJudul,
  periksaBerkas,
  periksaIsiZip,
  rakitTemplat,
  ukuranTerurai,
  type IsiTemplat,
  type KonteksTemplat,
} from "./templat";

const batas: KonteksDraf = {
  mingguEfektif: [1, 2, 4],
  semuaMinggu: [1, 2, 3, 4],
  mingguUjian: [{ minggu: 3, jenis: "UTS" }],
  subCpmkTersedia: ["SC1", "SC2"],
  subCpmkPerMinggu: { 1: ["SC1"], 2: ["SC2"], 3: [], 4: ["SC1"] },
  refPustaka: ["UTAMA-1"],
};

const konteks: KonteksTemplat = { rpkpsId: "rp1", kodeMk: "TI214", batas };

const DESKRIPSI = "Mata kuliah ini membahas dasar-dasar pemrograman berorientasi objek.";

function isiSah(): IsiTemplat {
  const mgg = (baris: number, minggu: string, sub: string, over: object = {}) => ({
    baris, minggu, jenis: "EFEKTIF", subCpmk: sub, topik: `Topik minggu ${minggu}`,
    subtopik: "", metode: "", aktivitasDosen: "", aktivitasMahasiswa: "",
    tugasTerstruktur: "", penilaianJenis: "", penilaianSistem: "", bobot: "",
    komponen: "", indikator: "", pustaka: "", ...over,
  });
  return {
    cap: { kodeMk: "TI214", rpkpsId: "rp1" },
    identitas: { deskripsi: DESKRIPSI, barisDeskripsi: 2, pembuka: "Setelah mengikuti mata kuliah ini mahasiswa mampu:", barisPembuka: 3 },
    mingguan: [
      mgg(2, "1", "SC1", { bobot: "15", komponen: "Tugas", indikator: "Ketepatan konsep" }),
      mgg(3, "2", "SC2", { bobot: "25", komponen: "Tugas", indikator: "Ketepatan konsep" }),
      mgg(4, "4", "SC1", { bobot: "30", komponen: "Kuis", indikator: "Skor kuis" }),
    ],
    komponen: [
      { baris: 2, nama: "Tugas", bobot: "40" },
      { baris: 3, nama: "UTS", bobot: "30" },
      { baris: 4, nama: "Kuis", bobot: "30" },
    ],
    ujian: [{ baris: 2, minggu: "3", jenis: "UTS", bobot: "30", komponen: "UTS" }],
    tugas: [],
    kriteria: [],
    kisi: [
      { baris: 2, jenis: "UTS", durasi: "90", nomor: "1", subCpmk: "SC1", levelBloom: "C2", bentuk: "ESAI", jumlah: "2", skor: "60", indikator: "" },
      { baris: 3, jenis: "UTS", durasi: "", nomor: "2", subCpmk: "SC2", levelBloom: "C3", bentuk: "STUDI KASUS", jumlah: "1", skor: "40", indikator: "" },
    ],
    pustaka: [{ baris: 2, jenis: "UTAMA", nomor: "1", teks: "Buku yang sudah ada di dokumen", url: "" }],
    lembarAda: ["petunjuk", "identitas", "mingguan", "komponen", "ujian", "tugas", "kriteria", "kisi", "pustaka"],
    kolomHilang: {},
    lembarBesar: [],
  };
}

const kodeTemuan = (isi: IsiTemplat, k = konteks) => rakitTemplat(isi, k).temuan.map((t) => t.kode);

describe("rakitTemplat — berkas yang sah", () => {
  it("tanpa temuan, dan menghasilkan draf yang sama dengan isi berkas", () => {
    const h = rakitTemplat(isiSah(), konteks);
    assert.deepEqual(h.temuan, []);
    assert.ok(h.draf);
    assert.equal(h.draf.pertemuan.length, 3);
    assert.equal(h.draf.ujian[0].komponenNilai, "UTS");
    assert.equal(h.draf.kisiKisi[0].durasiMenit, 90);
    // "STUDI KASUS" → enum, tidak ada temuan bentuk asing.
    assert.equal(h.draf.kisiKisi[0].butir[1].bentuk, "STUDI_KASUS");
  });

  it("pustaka yang sudah ada dipertahankan, tidak diusulkan ulang", () => {
    const h = rakitTemplat(isiSah(), konteks);
    assert.deepEqual(h.draf?.pustakaBaru, []);
  });
});

describe("rakitTemplat — angka dosen TIDAK ditambal (T2)", () => {
  it("bobot yang tidak pas 100 dilaporkan, tidak dinormalkan", () => {
    const isi = isiSah();
    isi.mingguan[2].bobot = "20"; // total 90; Kuis 20 ≠ 30
    const h = rakitTemplat(isi, konteks);
    assert.ok(h.temuan.some((t) => t.kode === "D-BOBOT-MINGGUAN"));
    assert.ok(h.temuan.some((t) => t.kode === "D-KOMPONEN-TIDAK-COCOK"));
    assert.equal(h.draf?.pertemuan[2].bobot, 20, "angka dosen tetap apa adanya");
  });
});

describe("rakitTemplat — lapis 2, sel menjadi nilai", () => {
  it("angka berkoma Indonesia dan tanda persen dibaca", () => {
    assert.deepEqual(bacaAngka("12,5"), { ok: true, nilai: 12.5 });
    assert.deepEqual(bacaAngka(" 30% "), { ok: true, nilai: 30 });
    assert.deepEqual(bacaAngka(""), { ok: false, kosong: true });
    assert.deepEqual(bacaAngka("dua puluh"), { ok: false, kosong: false });
    assert.deepEqual(bacaAngka("1.500.000"), { ok: false, kosong: false });
  });

  it("angka tak sah menjadi temuan berlokasi lembar, baris, dan kolom", () => {
    const isi = isiSah();
    isi.mingguan[1].bobot = "dua puluh lima";
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "I-ANGKA-TIDAK-SAH");
    assert.ok(t);
    assert.equal(t.lembar, "mingguan");
    assert.equal(t.baris, 3);
    assert.equal(t.kolom, "Bobot (%)");
  });

  it("bobot negatif dan di atas 100 ditolak", () => {
    for (const salah of ["-5", "150"]) {
      const isi = isiSah();
      isi.komponen[0].bobot = salah;
      assert.ok(kodeTemuan(isi).includes("I-ANGKA-TIDAK-SAH"), salah);
    }
  });

  it("nomor pecahan pada kolom bulat menjadi I-BUKAN-BULAT", () => {
    const isi = isiSah();
    isi.mingguan[0].minggu = "1,5";
    assert.ok(kodeTemuan(isi).includes("I-BUKAN-BULAT"));
  });

  it("teks melewati batas ditolak, tidak dipotong diam-diam", () => {
    const isi = isiSah();
    isi.mingguan[0].topik = "x".repeat(BATAS_TEMPLAT.topik + 1);
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "I-TERLALU-PANJANG");
    assert.ok(t);
    assert.equal(t.params?.maks, BATAS_TEMPLAT.topik);
  });

  it("daftar terlalu banyak ditolak", () => {
    const isi = isiSah();
    isi.mingguan[0].indikator = Array.from({ length: BATAS_TEMPLAT.indikatorJumlah + 1 }, (_, i) => `i${i}`).join("\n");
    assert.ok(kodeTemuan(isi).includes("I-TERLALU-BANYAK"));
  });

  it("karakter kendali dan pengarah bidi dibuang dari sel", () => {
    assert.equal(bersihkanSel("  a\u0000b\u202Ec\r\nd  "), "abc\nd");
    const isi = isiSah();
    isi.mingguan[0].topik = "Topik\u202E berbahaya";
    assert.equal(rakitTemplat(isi, konteks).draf?.pertemuan[0].topik, "Topik berbahaya");
  });

  it("nama komponen dipadankan tanpa peduli huruf dan spasi, lalu disamakan penulisannya", () => {
    const isi = isiSah();
    isi.mingguan[0].komponen = "  tugas ";
    isi.ujian[0].komponen = "uts";
    const h = rakitTemplat(isi, konteks);
    assert.deepEqual(h.temuan, []);
    assert.equal(h.draf?.pertemuan[0].komponenNilai, "Tugas");
    assert.equal(h.draf?.ujian[0].komponenNilai, "UTS");
  });

  it("komponen yang tak dikenal dibiarkan, lalu dilaporkan periksaDraf", () => {
    const isi = isiSah();
    isi.mingguan[0].komponen = "Praktikum";
    assert.ok(kodeTemuan(isi).includes("D-MINGGU-KOMPONEN-ASING"));
  });

  it("Sub-CPMK terjadwal yang berbeda dari kerangka menjadi temuan", () => {
    const isi = isiSah();
    isi.mingguan[1].subCpmk = "SC1";
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "I-KERANGKA-BEDA");
    assert.ok(t);
    assert.equal(t.params?.minggu, 2);
  });

  it("urutan Sub-CPMK terjadwal tidak berpengaruh", () => {
    const k: KonteksTemplat = {
      ...konteks,
      batas: { ...batas, subCpmkPerMinggu: { ...batas.subCpmkPerMinggu, 1: ["SC1", "SC2"] } },
    };
    const isi = isiSah();
    isi.mingguan[0].subCpmk = "SC2, SC1";
    assert.ok(!kodeTemuan(isi, k).includes("I-KERANGKA-BEDA"));
  });

  it("jenis ujian dan jenis kisi-kisi yang tidak dikenal ditolak", () => {
    const isi = isiSah();
    isi.ujian[0].jenis = "UUS";
    isi.kisi[0].jenis = "QUIZ";
    const kode = kodeTemuan(isi);
    assert.equal(kode.filter((k) => k === "I-ENUM-TIDAK-SAH").length, 2);
  });

  it("durasi kisi-kisi yang berbeda antar baris dilaporkan", () => {
    const isi = isiSah();
    isi.kisi[1].durasi = "60";
    assert.ok(kodeTemuan(isi).includes("I-DURASI-BEDA"));
  });

  it("kriteria yang menunjuk tugas yang tidak ada dilaporkan", () => {
    const isi = isiSah();
    isi.kriteria = [{ baris: 2, tugas: "9", nomor: "1", indikator: "x", rincian: "", bobot: "100" }];
    assert.ok(kodeTemuan(isi).includes("I-KRITERIA-TANPA-TUGAS"));
  });

  it("tugas beserta kriterianya dirakit, dan bobot kriteria diperiksa periksaDraf", () => {
    const isi = isiSah();
    isi.tugas = [{
      baris: 2, nomor: "1", nama: "Proyek", jenis: "kelompok", mingguMulai: "1", mingguSelesai: "2",
      bobot: "", komponen: "Tugas", subCpmk: "SC1, SC2", deskripsi: "Membangun aplikasi kecil.",
      uraian: "", format: "",
    }];
    isi.kriteria = [
      { baris: 2, tugas: "1", nomor: "1", indikator: "Desain", rincian: "a\nb", bobot: "60" },
    ];
    const h = rakitTemplat(isi, konteks);
    assert.equal(h.draf?.tugas[0].jenis, "KELOMPOK");
    assert.deepEqual(h.draf?.tugas[0].subCpmkKode, ["SC1", "SC2"]);
    assert.deepEqual(h.draf?.tugas[0].kriteria[0].rincian, ["a", "b"]);
    const t = h.temuan.find((x) => x.kode === "D-TUGAS-BOBOT-KRITERIA");
    assert.ok(t);
    assert.deepEqual([t.lembar, t.baris], ["tugas", 2]);
  });
});

describe("rakitTemplat — pustaka", () => {
  it("pustaka baru tanpa nomor mendapat nomor berikutnya, dihitung server", () => {
    const isi = isiSah();
    isi.pustaka.push(
      { baris: 3, jenis: "UTAMA", nomor: "", teks: "Buku baru nomor dua yang panjang", url: "" },
      { baris: 4, jenis: "DARING", nomor: "", teks: "Laman resmi dokumentasi bahasa", url: "https://contoh.id/x" },
      { baris: 5, jenis: "UTAMA", nomor: "", teks: "Buku baru nomor tiga yang panjang", url: "" },
    );
    const h = rakitTemplat(isi, konteks);
    assert.deepEqual(h.temuan, []);
    assert.deepEqual(
      h.draf?.pustakaBaru.map((p) => `${p.jenis}-${p.nomor}`),
      ["UTAMA-2", "DARING-1", "UTAMA-3"],
    );
  });

  it("alamat selain http/https ditolak", () => {
    const isi = isiSah();
    isi.pustaka.push({ baris: 3, jenis: "DARING", nomor: "1", teks: "Laman dengan alamat berbahaya", url: "javascript:alert(1)" });
    assert.ok(kodeTemuan(isi).includes("I-URL-TIDAK-SAH"));
  });

  it("jenis pustaka asing ditolak", () => {
    const isi = isiSah();
    isi.pustaka.push({ baris: 3, jenis: "KOMIK", nomor: "1", teks: "Bukan jenis pustaka yang sah", url: "" });
    assert.ok(kodeTemuan(isi).includes("I-ENUM-TIDAK-SAH"));
  });

  it("rujukan mingguan ke pustaka karangan dilaporkan dan dipetakan ke barisnya", () => {
    const isi = isiSah();
    isi.mingguan[0].pustaka = "utama-1, UTAMA-9";
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "D-PUSTAKA-KARANGAN");
    assert.ok(t);
    assert.deepEqual([t.lembar, t.baris], ["mingguan", 2]);
  });
});

describe("rakitTemplat — struktur berkas (lapis 1 lanjutan)", () => {
  it("cap kosong, cap mata kuliah lain, dan cap RPKPS lain ditolak dan menghentikan pembacaan", () => {
    const a = isiSah(); a.cap = null;
    assert.deepEqual(kodeTemuan(a), ["I-CAP-HILANG"]);
    const b = isiSah(); b.cap = { kodeMk: "TI999", rpkpsId: "rp1" };
    assert.deepEqual(kodeTemuan(b), ["I-CAP-BEDA-MK"]);
    const c = isiSah(); c.cap = { kodeMk: "ti214", rpkpsId: "rp2" };
    assert.deepEqual(kodeTemuan(c), ["I-CAP-BEDA-RPKPS"]);
    assert.equal(rakitTemplat(b, konteks).draf, null);
  });

  it("lembar yang hilang tidak terbaca sebagai kosong — kalau tidak, menghapus seluruh tugas", () => {
    const isi = isiSah();
    isi.lembarAda = isi.lembarAda.filter((l) => l !== "tugas");
    const h = rakitTemplat(isi, konteks);
    assert.equal(h.draf, null);
    assert.deepEqual(h.temuan.map((t) => [t.kode, t.lembar]), [["I-LEMBAR-HILANG", "tugas"]]);
  });

  it("kolom yang hilang dan lembar yang kebanyakan baris menghentikan pembacaan", () => {
    const isi = isiSah();
    isi.kolomHilang = { mingguan: ["Topik"] };
    isi.lembarBesar = ["tugas"];
    assert.deepEqual(kodeTemuan(isi), ["I-KOLOM-HILANG", "I-BARIS-BANYAK"]);
  });

  it("normalisasiJudul membuang petunjuk dalam kurung", () => {
    assert.equal(normalisasiJudul("Bobot (%)"), "bobot");
    assert.equal(normalisasiJudul("Subtopik (satu per baris sel)"), "subtopik");
    assert.equal(normalisasiJudul("  Kode   Sub-CPMK (pisah koma) "), "kode sub-cpmk");
  });
});

describe("rakitTemplat — lokasi temuan periksaDraf", () => {
  it("minggu yang belum bertopik menunjuk baris Mingguannya", () => {
    const isi = isiSah();
    isi.mingguan[2].topik = "";
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "D-TOPIK-KOSONG");
    assert.ok(t);
    assert.deepEqual([t.lembar, t.baris], ["mingguan", 4]);
  });

  it("ujian berbobot tanpa kisi-kisi menunjuk baris Ujian", () => {
    const isi = isiSah();
    isi.kisi = [];
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "D-UJIAN-BERBOBOT-TANPA-KISI");
    assert.ok(t);
    assert.deepEqual([t.lembar, t.baris], ["ujian", 2]);
  });

  it("temuan tanpa lokasi (total bobot) tetap tanpa lokasi", () => {
    const isi = isiSah();
    isi.komponen[0].bobot = "50";
    const t = rakitTemplat(isi, konteks).temuan.find((x) => x.kode === "D-BOBOT-KOMPONEN");
    assert.ok(t);
    assert.equal(t.lembar, undefined);
  });
});

describe("periksaBerkas dan periksaIsiZip", () => {
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);

  it("menolak berkas kosong, terlalu besar, bukan .xlsx, dan bukan ZIP", () => {
    assert.equal(periksaBerkas({ nama: "a.xlsx", ukuran: 0, kepala: zip })?.kode, "I-BERKAS-KOSONG");
    assert.equal(periksaBerkas({ nama: "a.xlsx", ukuran: BATAS_TEMPLAT.ukuranBayt + 1, kepala: zip })?.kode, "I-BERKAS-BESAR");
    assert.equal(periksaBerkas({ nama: "a.xls", ukuran: 10, kepala: zip })?.kode, "I-BERKAS-BUKAN-XLSX");
    // Ekstensi dan File.type dapat dikarang; bita pertamalah yang menentukan.
    assert.equal(
      periksaBerkas({ nama: "a.xlsx", ukuran: 10, kepala: new TextEncoder().encode("<html>") })?.kode,
      "I-BERKAS-BUKAN-XLSX",
    );
    assert.equal(periksaBerkas({ nama: "A.XLSX", ukuran: 10, kepala: zip }), null);
  });

  /** ZIP minimal: hanya direktori pusat, cukup untuk `ukuranTerurai`. */
  function zipPalsu(ukuranEntri: number[]): Uint8Array {
    const nama = 1;
    const cd = ukuranEntri.length * (46 + nama);
    const b = new Uint8Array(cd + 22);
    const v = new DataView(b.buffer);
    let p = 0;
    for (const u of ukuranEntri) {
      v.setUint32(p, 0x02014b50, true);
      v.setUint32(p + 24, u, true);
      v.setUint16(p + 28, nama, true);
      p += 46 + nama;
    }
    v.setUint32(p, 0x06054b50, true);
    v.setUint16(p + 10, ukuranEntri.length, true);
    v.setUint32(p + 12, cd, true);
    v.setUint32(p + 16, 0, true);
    return b;
  }

  it("menjumlahkan ukuran terurai dari direktori pusat, tanpa membuka entri", () => {
    assert.deepEqual(ukuranTerurai(zipPalsu([100, 250])), { total: 350, entri: 2 });
  });

  it("menolak ZIP yang membengkak, kebanyakan entri, atau rusak", () => {
    assert.equal(periksaIsiZip(zipPalsu([BATAS_TEMPLAT.ukuranTerurai + 1]))?.kode, "I-BERKAS-MEMBENGKAK");
    assert.equal(periksaIsiZip(zipPalsu(Array(BATAS_TEMPLAT.entriZip + 1).fill(1)))?.kode, "I-BERKAS-MEMBENGKAK");
    assert.equal(periksaIsiZip(zipPalsu([10, 10])), null);
    assert.equal(periksaIsiZip(new Uint8Array(64))?.kode, "I-BERKAS-RUSAK");
  });
});
