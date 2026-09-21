import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import type { KonteksDraf } from "@/domain/rpkps/draf";
import { periksaIsiZip, rakitTemplat, type KonteksTemplat } from "@/domain/rpkps/templat";
import { bacaTemplat, buatTemplat, type SumberTemplat } from "./templat-excel";

/** RPKPS yang sah menurut `periksaDraf`, lengkap dengan tugas dan dua kisi-kisi. */
function sumber(): SumberTemplat {
  const pert = (
    minggu: number, jenis: "EFEKTIF" | "UTS" | "UAS", sub: string[], over: object = {},
  ): SumberTemplat["pertemuan"][number] => ({
    minggu, jenis, topik: jenis === "EFEKTIF" ? `Topik ${minggu}` : null, subtopik: [],
    metodeNarasi: null, aktivitasDosen: null, aktivitasMahasiswa: null, tugasTerstruktur: null,
    penilaianJenis: null, penilaianSistem: null, bobot: 0, komponenNilaiId: null,
    subCpmk: sub.map((kode) => ({ subCpmk: { kode } })), indikator: [], pustaka: [], ...over,
  });
  return {
    id: "rp1",
    deskripsi: "Mata kuliah ini membahas dasar-dasar pemrograman berorientasi objek.",
    kalimatPembukaCpmk: "Setelah mengikuti mata kuliah ini mahasiswa mampu:",
    tahunAkademik: { kode: "2026/2027-GANJIL" },
    mataKuliah: {
      kode: "TI214", nama: "Pemrograman Berorientasi Objek", deskripsi: null,
      cpmk: [{ subCpmk: [{ kode: "SC1", rumusan: "Menjelaskan kelas" }, { kode: "SC2", rumusan: "Membuat objek" }] }],
    },
    komponenNilai: [
      { id: "k1", nama: "Tugas", bobot: "40" },
      { id: "k2", nama: "UTS", bobot: 30 },
      { id: "k3", nama: "UAS", bobot: 30 },
    ],
    pustaka: [{ jenis: "UTAMA", nomor: 1, teks: "Deitel, Java How to Program", url: null }],
    pertemuan: [
      pert(1, "EFEKTIF", ["SC1"], {
        subtopik: ["Kelas", "Objek"], bobot: "15", komponenNilaiId: "k1",
        indikator: [{ teks: "Ketepatan konsep" }, { teks: "Kerapian kode" }],
        pustaka: [{ pustaka: { jenis: "UTAMA", nomor: 1 } }],
        metodeNarasi: "Ceramah\nDiskusi", // baris baru dalam sel harus selamat
      }),
      pert(2, "EFEKTIF", ["SC2"], { bobot: "25", komponenNilaiId: "k1", indikator: [{ teks: "Ketepatan" }] }),
      pert(3, "UTS", [], { bobot: 30, komponenNilaiId: "k2" }),
      pert(4, "UAS", [], { bobot: 30, komponenNilaiId: "k3" }),
    ],
    tugas: [{
      nomor: 1, nama: "Proyek Akhir", jenis: "KELOMPOK", mingguMulai: 1, mingguSelesai: 2, bobot: 0,
      deskripsi: "Membangun aplikasi kecil.", uraianTugas: null, formatLuaran: "Repositori",
      komponenNilai: { nama: "Tugas" }, subCpmk: [{ subCpmk: { kode: "SC1" } }, { subCpmk: { kode: "SC2" } }],
      kriteria: [
        { nomor: 1, indikator: "Desain", rincian: ["Diagram kelas", "Pola desain"], bobot: 60 },
        { nomor: 2, indikator: "Kode", rincian: [], bobot: "40" },
      ],
    }],
    kisiKisi: [
      { jenis: "UTS", durasiMenit: 90, butir: [
        { nomor: 1, levelBloom: "C2", bentuk: "ESAI", jumlahButir: 2, skor: 100, indikator: null, subCpmk: { kode: "SC1" } },
      ] },
      { jenis: "UAS", durasiMenit: null, butir: [
        { nomor: 1, levelBloom: "C3", bentuk: "STUDI_KASUS", jumlahButir: 1, skor: 60, indikator: "Kasus", subCpmk: { kode: "SC2" } },
        { nomor: 2, levelBloom: "C4", bentuk: "PROYEK", jumlahButir: 1, skor: 40, indikator: null, subCpmk: { kode: "SC1" } },
      ] },
    ],
  };
}

const batas: KonteksDraf = {
  mingguEfektif: [1, 2],
  semuaMinggu: [1, 2, 3, 4],
  mingguUjian: [{ minggu: 3, jenis: "UTS" }, { minggu: 4, jenis: "UAS" }],
  subCpmkTersedia: ["SC1", "SC2"],
  subCpmkPerMinggu: { 1: ["SC1"], 2: ["SC2"], 3: [], 4: [] },
  refPustaka: ["UTAMA-1"],
};
const konteks: KonteksTemplat = { rpkpsId: "rp1", kodeMk: "TI214", batas };

const keBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("template RPKPS — pulang-pergi", () => {
  it("ekspor lalu impor: tanpa temuan, dan draf memuat isi dokumen persis", async () => {
    const berkas = await buatTemplat(sumber(), "id");
    const isi = await bacaTemplat(keBuffer(berkas));
    const h = rakitTemplat(isi, konteks);

    assert.deepEqual(h.temuan, []);
    const d = h.draf;
    assert.ok(d);
    assert.deepEqual(d.pertemuan[0].subtopik, ["Kelas", "Objek"]);
    assert.deepEqual(d.pertemuan[0].indikator, ["Ketepatan konsep", "Kerapian kode"]);
    assert.deepEqual(d.pertemuan[0].pustakaRef, ["UTAMA-1"]);
    assert.equal(d.pertemuan[0].metodeNarasi, "Ceramah\nDiskusi");
    assert.equal(d.pertemuan[0].bobot, 15);
    assert.equal(d.pertemuan[0].komponenNilai, "Tugas");
    assert.equal(d.pertemuan[0].tugasTerstruktur, null);
    assert.deepEqual(d.komponenNilai, [
      { nama: "Tugas", bobot: 40 }, { nama: "UTS", bobot: 30 }, { nama: "UAS", bobot: 30 },
    ]);
    assert.deepEqual(d.ujian, [
      { minggu: 3, jenis: "UTS", bobot: 30, komponenNilai: "UTS" },
      { minggu: 4, jenis: "UAS", bobot: 30, komponenNilai: "UAS" },
    ]);
    assert.deepEqual(d.pustakaBaru, []);
    assert.equal(d.tugas[0].jenis, "KELOMPOK");
    assert.deepEqual(d.tugas[0].kriteria.map((k) => [k.nomor, k.bobot, k.rincian]), [
      [1, 60, ["Diagram kelas", "Pola desain"]],
      [2, 40, []],
    ]);
    assert.equal(d.kisiKisi.find((k) => k.jenis === "UTS")?.durasiMenit, 90);
    assert.equal(d.kisiKisi.find((k) => k.jenis === "UAS")?.durasiMenit, null);
    assert.equal(d.kisiKisi.find((k) => k.jenis === "UAS")?.butir[0].bentuk, "STUDI_KASUS");
  });

  it("berkas berbahasa Inggris tetap terbaca: pengenal lembar dan kolom tidak diterjemahkan", async () => {
    const isi = await bacaTemplat(keBuffer(await buatTemplat(sumber(), "en")));
    assert.deepEqual(rakitTemplat(isi, konteks).temuan, []);
  });

  it("berkas yang dihasilkan lolos pemeriksaan isi ZIP", async () => {
    const berkas = await buatTemplat(sumber(), "id");
    assert.equal(periksaIsiZip(new Uint8Array(berkas)), null);
  });

  it("cap memuat kode MK dan id RPKPS", async () => {
    const isi = await bacaTemplat(keBuffer(await buatTemplat(sumber(), "id")));
    assert.deepEqual(isi.cap, { kodeMk: "TI214", rpkpsId: "rp1" });
  });
});

describe("template RPKPS — berkas yang disunting dosen", () => {
  async function sunting(ubah: (wb: ExcelJS.Workbook) => void) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(keBuffer(await buatTemplat(sumber(), "id")));
    ubah(wb);
    const keluar = Buffer.from(await wb.xlsx.writeBuffer());
    return rakitTemplat(await bacaTemplat(keBuffer(keluar)), konteks);
  }

  it("angka gaya Indonesia yang diketik sebagai teks dibaca", async () => {
    const h = await sunting((wb) => {
      const ws = wb.getWorksheet("Mingguan")!;
      ws.getCell("L2").value = "15,0"; // 15
    });
    assert.deepEqual(h.temuan, []);
    assert.equal(h.draf?.pertemuan[0].bobot, 15);
  });

  it("sel berformat persen dibaca sebagai persen, bukan pecahan", async () => {
    const h = await sunting((wb) => {
      const c = wb.getWorksheet("Komponen Nilai")!.getCell("B2");
      c.value = 0.4;
      // Gaya diberikan sebagai objek BARU: exceljs membagi objek gaya antar
      // sel hasil muatan, dan mengubah `numFmt` di tempat menular ke sel lain.
      c.style = { numFmt: "0%" };
    });
    assert.deepEqual(h.temuan, []);
    assert.equal(h.draf?.komponenNilai[0].bobot, 40);
  });

  it("sel rumus dibaca hasilnya, bukan rumusnya", async () => {
    const h = await sunting((wb) => {
      wb.getWorksheet("Komponen Nilai")!.getCell("B2").value = { formula: "20+20", result: 40 };
    });
    assert.deepEqual(h.temuan, []);
    assert.equal(h.draf?.komponenNilai[0].bobot, 40);
  });

  it("baris tambahan pada lembar bebas terbaca, dan bobot yang jadi salah dilaporkan", async () => {
    const h = await sunting((wb) => {
      wb.getWorksheet("Komponen Nilai")!.addRow(["Kuis", 10]);
    });
    assert.ok(h.temuan.some((t) => t.kode === "D-BOBOT-KOMPONEN"));
    assert.ok(h.temuan.some((t) => t.kode === "D-KOMPONEN-TANPA-ASESMEN"));
  });

  it("baris pustaka baru tanpa nomor mendapat nomor berikutnya", async () => {
    const h = await sunting((wb) => {
      wb.getWorksheet("Pustaka")!.addRow(["UTAMA", "", "Buku kedua yang ditambahkan dosen", ""]);
    });
    assert.deepEqual(h.temuan, []);
    assert.deepEqual(h.draf?.pustakaBaru.map((p) => `${p.jenis}-${p.nomor}`), ["UTAMA-2"]);
  });

  it("cap dari RPKPS lain ditolak dan tidak ada draf yang dihasilkan", async () => {
    const h = await sunting((wb) => {
      wb.getWorksheet("Petunjuk")!.getCell("B2").value = "rp-lain";
    });
    assert.equal(h.draf, null);
    assert.deepEqual(h.temuan.map((t) => t.kode), ["I-CAP-BEDA-RPKPS"]);
  });

  it("lembar yang dihapus dan kolom yang dihapus menghentikan pembacaan", async () => {
    const a = await sunting((wb) => wb.removeWorksheet(wb.getWorksheet("Tugas")!.id));
    assert.deepEqual(a.temuan.map((t) => t.kode), ["I-LEMBAR-HILANG"]);

    const b = await sunting((wb) => wb.getWorksheet("Mingguan")!.spliceColumns(4, 1)); // "Topik"
    assert.ok(b.temuan.some((t) => t.kode === "I-KOLOM-HILANG"));
    assert.equal(b.draf, null);
  });

  it("kolom yang digeser tetap terbaca, karena dicocokkan lewat judul", async () => {
    // Menukar posisi kolom Bobot dan Komponen Nilai tidak boleh menukar artinya.
    const h = await sunting((wb) => {
      const ws = wb.getWorksheet("Komponen Nilai")!;
      ws.spliceColumns(1, 0, ["Catatan pribadi", "x", "x", "x"]);
    });
    assert.deepEqual(h.temuan, []);
    assert.equal(h.draf?.komponenNilai[0].nama, "Tugas");
  });

  it("lembar dengan baris melebihi batas ditolak", async () => {
    const h = await sunting((wb) => {
      const ws = wb.getWorksheet("Pustaka")!;
      for (let i = 0; i < 510; i++) ws.addRow(["DARING", 100 + i, `Referensi nomor ${i} yang cukup panjang`, ""]);
    });
    assert.deepEqual(h.temuan.map((t) => t.kode), ["I-BARIS-BANYAK"]);
  });

  it("berkas yang bukan XLSX melempar, untuk diterjemahkan pemanggil", async () => {
    await assert.rejects(() => bacaTemplat(new TextEncoder().encode("bukan zip").buffer as ArrayBuffer));
  });
});
