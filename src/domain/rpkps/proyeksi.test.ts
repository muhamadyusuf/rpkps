import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proyeksiIsi, sidikDokumen, type SumberProyeksi } from "./proyeksi";

/**
 * Kunci regresi sidik dokumen.
 *
 * `proyeksiIsi()` adalah dasar sidik SHA-256 setiap RPKPS terbit. Menambah,
 * membuang, atau mengganti nama SATU medan saja akan mengubah sidik SELURUH
 * dokumen yang sudah ditandatangani — memunculkan peringatan pergeseran palsu
 * di mana-mana dan meruntuhkan satu-satunya bukti bahwa berkas yang dicetak
 * hari ini sama dengan yang disahkan Kaprodi.
 *
 * Uji ini mengunci sidik sebuah dokumen contoh sebagai nilai HARFIAH. Contoh
 * dan kuncinya sengaja ditaruh di berkas yang sama: siapa pun yang mengubah
 * contohnya akan melihat nilai kunci tepat di bawahnya, dan tahu bahwa
 * memperbarui angka itu berarti menyatakan sidik seluruh arsip boleh bergeser.
 *
 * KALAU UJI INI GAGAL: jangan perbarui angkanya. Cari apa yang menyentuh
 * `proyeksiIsi()`, dan pindahkan ke ruang sidik yang lain (docs/11 §6.1–6.2).
 */

const CONTOH: SumberProyeksi = {
  deskripsi: "Mata kuliah ini membahas perancangan basis data relasional.",
  kalimatPembukaCpmk: "Setelah menyelesaikan mata kuliah ini, mahasiswa akan mampu:",
  ambangKelulusanMhs: 55,
  ambangKetercapaianMk: 85,
  minimalKehadiranPersen: 80,
  tahunAkademik: { kode: "2025/2026-GENAP" },
  mataKuliah: {
    kode: "TI214",
    nama: "Basis Data",
    semester: 4,
    status: "WAJIB",
    sksTeori: 2,
    sksPraktik: 1,
    cpl: [{ cpl: { kode: "CPL06", deskripsi: "Mampu merancang sistem informasi." } }],
    cpmk: [
      {
        kode: "CPMK081",
        rumusan: "Mahasiswa mampu merancang skema basis data relasional.",
        levelBloom: "C6",
        cpl: [{ cpl: { kode: "CPL06" } }],
        subCpmk: [
          {
            kode: "CPMK081-1",
            rumusan: "Mahasiswa mampu menjelaskan model data relasional.",
            levelBloom: "C2",
          },
        ],
      },
    ],
  },
  pengampu: [{ peran: "KOORDINATOR", pengguna: { nama: "Dr. Sari", nidn: "0401019001" } }],
  pustaka: [
    { jenis: "UTAMA", nomor: 1, teks: "Elmasri & Navathe, Fundamentals of Database Systems", url: null },
  ],
  komponenNilai: [
    { nama: "Tugas", bobot: 30 },
    { nama: "UTS", bobot: 30 },
    { nama: "UAS", bobot: 40 },
  ],
  pertemuan: [
    {
      minggu: 1,
      jenis: "EFEKTIF",
      topik: "Pengantar basis data",
      subtopik: ["Definisi", "Sejarah"],
      metodeNarasi: "Kuliah 100 menit, diskusi 50 menit.",
      aktivitasDosen: "Menjelaskan konsep.",
      aktivitasMahasiswa: "Mendiskusikan kasus.",
      tugasTerstruktur: "Ringkasan bacaan.",
      penilaianJenis: "Kuis",
      penilaianSistem: "Rubrik 4 tingkat",
      bobot: 5,
      subCpmk: [{ subCpmk: { kode: "CPMK081-1" } }],
      aktivitas: [{ nama: "Kuliah", kategori: "TM", menit: 100 }],
      indikator: [{ teks: "Menyebutkan tiga ciri model relasional" }],
      pustaka: [{ pustaka: { nomor: 1 } }],
    },
  ],
  kisiKisi: [
    {
      jenis: "UTS",
      totalSkor: 100,
      durasiMenit: 90,
      catatan: "Terbuka buku.",
      butir: [
        {
          nomor: 1,
          subCpmk: { kode: "CPMK081-1" },
          levelBloom: "C2",
          bentuk: "ESAI",
          jumlahButir: 2,
          skor: 100,
          indikator: "Menjelaskan normalisasi",
        },
      ],
    },
  ],
  tugas: [
    {
      nomor: 1,
      nama: "Perancangan skema",
      jenis: "KELOMPOK",
      mingguMulai: 9,
      mingguSelesai: 16,
      bobot: 30,
      deskripsi: "Merancang skema untuk studi kasus nyata.",
      uraianTugas: "Kumpulkan ERD dan skema relasional.",
      formatLuaran: "PDF",
      ketentuanLain: null,
      subCpmk: [{ subCpmk: { kode: "CPMK081-1" } }],
      kriteria: [{ nomor: 1, indikator: "Ketepatan ERD", rincian: ["Entitas", "Relasi"], bobot: 100 }],
      linimasa: [{ minggu: 9, tahapan: "Analisis", aktivitas: "Wawancara pengguna" }],
    },
  ],
};

/**
 * Sidik dokumen contoh di atas. JANGAN diperbarui untuk membuat uji lulus.
 */
const SIDIK_TERKUNCI = "3eb8e737eca34f12484c06f929707134ed7874a7cb661a7fa986eac6cfb5a708";

describe("regresi sidik dokumen", () => {
  it("sidik dokumen contoh tidak bergeser", () => {
    assert.equal(sidikDokumen(CONTOH), SIDIK_TERKUNCI);
  });

  it("proyeksi tidak memuat satu pun medan berbahasa Inggris", () => {
    // Penjaga arah: L4 menambahkan 33 kolom `*En`, dan satu saja yang bocor
    // ke sini menggeser sidik seluruh arsip. Ruangnya ada di `proyeksi-en.ts`.
    const teks = JSON.stringify(proyeksiIsi(CONTOH));
    const bocor = [...teks.matchAll(/"(\w+En)":/g)].map((m) => m[1]);
    assert.deepEqual(bocor, [], `medan Inggris bocor ke proyeksiIsi: ${bocor.join(", ")}`);
  });

  it("mengubah isi memang menggeser sidiknya", () => {
    // Tanpa ini, uji di atas juga akan lulus seandainya `proyeksiIsi`
    // mengembalikan objek kosong.
    const diubah: SumberProyeksi = { ...CONTOH, deskripsi: "Berbeda." };
    assert.notEqual(sidikDokumen(diubah), SIDIK_TERKUNCI);
  });
});
