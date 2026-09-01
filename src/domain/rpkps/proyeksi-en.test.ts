import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proyeksiIsi, sidikDokumen, type SumberProyeksi } from "./proyeksi";
import { proyeksiIsiEn, sidikDokumenEn, type SumberProyeksiEn } from "./proyeksi-en";

/**
 * Dokumen contoh minimal, lengkap dengan terjemahannya.
 *
 * Sengaja kecil: yang diuji di sini bukan cakupan medan (itu tugas penjaga
 * bentuk di bawah), melainkan PERILAKU — arah cadangan, pengenal yang tidak
 * ikut diterjemahkan, dan pemisahan kedua ruang sidik.
 */
const DASAR: SumberProyeksiEn = {
  deskripsi: "Membahas basis data.",
  deskripsiEn: "Covers databases.",
  kalimatPembukaCpmk: "Mahasiswa akan mampu:",
  kalimatPembukaCpmkEn: null,
  ambangKelulusanMhs: 55,
  ambangKetercapaianMk: 85,
  minimalKehadiranPersen: 80,
  tahunAkademik: { kode: "2025/2026-GENAP" },
  mataKuliah: {
    kode: "TI214",
    nama: "Basis Data",
    namaEn: "Databases",
    semester: 4,
    status: "WAJIB",
    sksTeori: 2,
    sksPraktik: 1,
    cpl: [{ cpl: { kode: "CPL06", deskripsi: "Mampu merancang.", deskripsiEn: null } }],
    cpmk: [
      {
        kode: "CPMK081",
        rumusan: "Mampu merancang skema.",
        rumusanEn: "Able to design a schema.",
        levelBloom: "C6",
        cpl: [{ cpl: { kode: "CPL06" } }],
        subCpmk: [
          {
            kode: "CPMK081-1",
            rumusan: "Mampu menjelaskan model.",
            rumusanEn: null,
            levelBloom: "C2",
          },
        ],
      },
    ],
  },
  pengampu: [{ peran: "KOORDINATOR", pengguna: { nama: "Dr. Sari", nidn: "0401019001" } }],
  pustaka: [{ jenis: "UTAMA", nomor: 1, teks: "Elmasri & Navathe", url: null }],
  komponenNilai: [{ nama: "UTS", namaEn: "Midterm", bobot: 100 }],
  pertemuan: [
    {
      minggu: 1,
      jenis: "EFEKTIF",
      topik: "Pengantar",
      topikEn: "Introduction",
      subtopik: ["Definisi", "Sejarah"],
      subtopikEn: ["Definition", "History"],
      metodeNarasi: "Kuliah.",
      metodeNarasiEn: null,
      aktivitasDosen: "Menjelaskan.",
      aktivitasDosenEn: null,
      aktivitasMahasiswa: "Berdiskusi.",
      aktivitasMahasiswaEn: null,
      tugasTerstruktur: null,
      tugasTerstrukturEn: null,
      penilaianJenis: "Kuis",
      penilaianJenisEn: "Quiz",
      penilaianSistem: null,
      penilaianSistemEn: null,
      bobot: 100,
      subCpmk: [{ subCpmk: { kode: "CPMK081-1" } }],
      aktivitas: [{ nama: "Kuliah", namaEn: "Lecture", kategori: "TM", menit: 100 }],
      indikator: [{ teks: "Menyebutkan ciri", teksEn: null }],
      pustaka: [{ pustaka: { nomor: 1 } }],
    },
  ],
  kisiKisi: [],
  tugas: [],
};

/** Bentuk Indonesia dari dokumen yang sama — untuk `proyeksiIsi`. */
const DASAR_ID = DASAR as unknown as SumberProyeksi;

describe("proyeksi Inggris", () => {
  it("memakai terjemahan bila ada", () => {
    const p = proyeksiIsiEn(DASAR);
    assert.equal(p.deskripsi, "Covers databases.");
    assert.equal(p.mataKuliah.nama, "Databases");
    assert.equal(p.pertemuan[0].topik, "Introduction");
    assert.deepEqual(p.pertemuan[0].subtopik, ["Definition", "History"]);
    assert.equal(p.komponenNilai[0].nama, "Midterm");
  });

  it("mencadangkan ke bahasa Indonesia per medan, bukan per dokumen", () => {
    // Dokumen Inggris yang separuh medannya kosong tidak berguna bagi siapa
    // pun; yang belum diterjemahkan tampil apa adanya dan halaman publik
    // menerangkannya sekali di kepala dokumen.
    const p = proyeksiIsiEn(DASAR);
    assert.equal(p.kalimatPembukaCpmk, "Mahasiswa akan mampu:");
    assert.equal(p.cpl[0].deskripsi, "Mampu merancang.");
    assert.equal(p.cpmk[0].subCpmk[0].rumusan, "Mampu menjelaskan model.");
    assert.equal(p.pertemuan[0].metodeNarasi, "Kuliah.");
    assert.equal(p.pertemuan[0].indikator[0], "Menyebutkan ciri");
  });

  it("pengenal tidak ikut diterjemahkan", () => {
    // Menerjemahkan kode justru memutus penelusuran antara kedua versi, dan
    // judul buku yang diterjemahkan membuat sitasinya tidak dapat dilacak.
    const p = proyeksiIsiEn(DASAR);
    assert.equal(p.mataKuliah.kode, "TI214");
    assert.equal(p.cpmk[0].kode, "CPMK081");
    assert.equal(p.tahunAkademik, "2025/2026-GENAP");
    assert.equal(p.pengampu[0].nama, "Dr. Sari");
    assert.equal(p.pengampu[0].nidn, "0401019001");
    assert.equal(p.pustaka[0].teks, "Elmasri & Navathe");
  });

  it("daftar kosong dihitung belum diterjemahkan", () => {
    const p = proyeksiIsiEn({
      ...DASAR,
      pertemuan: [{ ...DASAR.pertemuan[0], subtopikEn: [] }],
    });
    assert.deepEqual(p.pertemuan[0].subtopik, ["Definisi", "Sejarah"]);
  });

  it("bentuknya identik dengan proyeksi Indonesia", () => {
    // `DokumenPublik` memuat keduanya, dan komponen halaman publik tidak tahu
    // ia sedang merender versi yang mana. Kunci yang berbeda akan muncul
    // sebagai bagian yang hilang diam-diam di halaman berbahasa Inggris.
    const kunci = (o: unknown): unknown =>
      Array.isArray(o)
        ? o.length > 0
          ? [kunci(o[0])]
          : []
        : o !== null && typeof o === "object"
          ? Object.fromEntries(
              Object.entries(o)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, kunci(v)]),
            )
          : typeof o;

    assert.deepEqual(kunci(proyeksiIsiEn(DASAR)), kunci(proyeksiIsi(DASAR_ID)));
  });
});

describe("dua ruang sidik", () => {
  it("medan Inggris TIDAK menyentuh sidik Indonesia", () => {
    // Penjaga terpenting seluruh L5. Kalau ini gagal, sidik SETIAP dokumen
    // yang sudah ditandatangani ikut bergeser.
    const tanpa = sidikDokumen(DASAR_ID);
    const dengan = sidikDokumen({
      ...DASAR,
      deskripsiEn: "Something else entirely.",
      mataKuliah: { ...DASAR.mataKuliah, namaEn: "Renamed" },
    } as unknown as SumberProyeksi);
    assert.equal(dengan, tanpa);
  });

  it("kedua sidik berbeda ketika ada terjemahan", () => {
    assert.notEqual(sidikDokumenEn(DASAR), sidikDokumen(DASAR_ID));
  });

  it("sidik Inggris sama dengan sidik Indonesia bila tidak ada terjemahan", () => {
    // Bukan kebetulan: tanpa satu pun terjemahan, `proyeksiIsiEn` mencadangkan
    // seluruh medan sehingga hasilnya dokumen yang sama persis. Inilah sebabnya
    // `bekukanRpkps` tidak menulis `isiEn` ketika belum ada yang diterjemahkan
    // — menyimpannya hanya menggandakan dokumen yang identik.
    const kosong: SumberProyeksiEn = {
      ...DASAR,
      deskripsiEn: null,
      kalimatPembukaCpmkEn: null,
      mataKuliah: {
        ...DASAR.mataKuliah,
        namaEn: null,
        cpmk: DASAR.mataKuliah.cpmk.map((c) => ({ ...c, rumusanEn: null })),
      },
      komponenNilai: DASAR.komponenNilai.map((k) => ({ ...k, namaEn: null })),
      pertemuan: DASAR.pertemuan.map((p) => ({
        ...p,
        topikEn: null,
        subtopikEn: [],
        penilaianJenisEn: null,
        aktivitas: p.aktivitas.map((a) => ({ ...a, namaEn: null })),
      })),
    };
    assert.equal(sidikDokumenEn(kosong), sidikDokumen(DASAR_ID));
  });

  it("mengubah terjemahan menggeser sidik Inggris, bukan sidik Indonesia", () => {
    const a = sidikDokumenEn(DASAR);
    const b = sidikDokumenEn({ ...DASAR, deskripsiEn: "Covers relational databases." });
    assert.notEqual(a, b);
    assert.equal(sidikDokumen(DASAR_ID), sidikDokumen(DASAR_ID));
  });
});
