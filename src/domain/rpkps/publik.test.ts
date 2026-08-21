import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dokumenPublik,
  labelTahunAkademik,
  petaSubCpmk,
  pustakaPerJenis,
  ringkasSks,
} from "./publik";
import type { SumberProyeksi } from "./proyeksi";

/**
 * Sumber uji sengaja DIKOTORI: tiap objek diberi field yang tidak boleh keluar
 * ke publik — id, email, cap waktu, penggunaId. Prisma memang mengembalikan
 * baris lengkap seperti ini; yang menjaga halaman publik adalah proyeksinya,
 * bukan kehati-hatian di halaman.
 */
function sumberKotor(): SumberProyeksi {
  const kotoran = {
    id: "clx0000000000000000000000",
    dibuatPada: new Date("2026-01-01"),
    diubahPada: new Date("2026-02-02"),
    penggunaId: "clxpengguna0000000000000",
    email: "dosen@itts.ac.id",
  };

  return {
    ...kotoran,
    deskripsi: "Mata kuliah ini membahas perancangan basis data relasional.",
    kalimatPembukaCpmk: "Setelah menyelesaikan mata kuliah ini, mahasiswa mampu:",
    ambangKelulusanMhs: 55,
    ambangKetercapaianMk: 85,
    minimalKehadiranPersen: 80,
    tahunAkademik: { ...kotoran, kode: "2025/2026-GENAP" },
    mataKuliah: {
      ...kotoran,
      kode: "TI214",
      nama: "Basis Data",
      semester: 3,
      status: "WAJIB",
      sksTeori: 2,
      sksPraktik: 1,
      cpl: [
        { ...kotoran, cpl: { ...kotoran, kode: "CPL-3", deskripsi: "Mampu merancang." } },
      ],
      cpmk: [
        {
          ...kotoran,
          kode: "CPMK-1",
          rumusan: "Mampu menjelaskan model relasional.",
          levelBloom: "C2",
          cpl: [{ ...kotoran, cpl: { ...kotoran, kode: "CPL-3" } }],
          subCpmk: [
            { ...kotoran, kode: "Sub-CPMK-1", rumusan: "Menjelaskan relasi.", levelBloom: "C2" },
            { ...kotoran, kode: "Sub-CPMK-2", rumusan: "Menyusun ERD.", levelBloom: "C3" },
          ],
        },
      ],
    },
    pengampu: [
      {
        ...kotoran,
        peran: "KOORDINATOR",
        pengguna: { ...kotoran, nama: "Muhamad Yusuf", nidn: "0401019001" },
      },
    ],
    pustaka: [
      { ...kotoran, jenis: "UTAMA", nomor: 1, teks: "Elmasri, Fundamentals.", url: null },
      { ...kotoran, jenis: "UTAMA", nomor: 2, teks: "Date, Introduction.", url: null },
      { ...kotoran, jenis: "PENDUKUNG", nomor: 3, teks: "Dokumentasi PostgreSQL.", url: "https://postgresql.org" },
    ],
    komponenNilai: [{ ...kotoran, nama: "Ujian Tengah Semester", bobot: 15 }],
    pertemuan: [
      {
        ...kotoran,
        minggu: 1,
        jenis: "EFEKTIF",
        topik: "Pengantar basis data",
        subtopik: ["Definisi", "Sejarah"],
        metodeNarasi: "Kuliah 100 menit",
        aktivitasDosen: "Memaparkan",
        aktivitasMahasiswa: "Menyimak",
        tugasTerstruktur: null,
        penilaianJenis: "Kuis",
        penilaianSistem: "Skor",
        bobot: 5,
        subCpmk: [{ ...kotoran, subCpmk: { ...kotoran, kode: "Sub-CPMK-1" } }],
        aktivitas: [{ ...kotoran, nama: "Kuliah", kategori: "TM", menit: 100 }],
        indikator: [{ ...kotoran, teks: "Ketepatan definisi" }],
        pustaka: [{ ...kotoran, pustaka: { ...kotoran, nomor: 1 } }],
      },
    ],
    kisiKisi: [
      {
        ...kotoran,
        jenis: "UTS",
        totalSkor: 100,
        durasiMenit: 90,
        catatan: null,
        butir: [
          {
            ...kotoran,
            nomor: 1,
            subCpmk: { ...kotoran, kode: "Sub-CPMK-1" },
            levelBloom: "C2",
            bentuk: "ESAI",
            jumlahButir: 2,
            skor: 20,
            indikator: "Menjelaskan relasi",
          },
        ],
      },
    ],
    tugas: [
      {
        ...kotoran,
        nomor: 1,
        nama: "Perancangan ERD",
        jenis: "PROYEK",
        mingguMulai: 3,
        mingguSelesai: 7,
        bobot: 20,
        deskripsi: "Merancang ERD untuk kasus nyata.",
        uraianTugas: "Pilih satu studi kasus.",
        formatLuaran: "PDF",
        ketentuanLain: null,
        subCpmk: [{ ...kotoran, subCpmk: { ...kotoran, kode: "Sub-CPMK-2" } }],
        kriteria: [
          { ...kotoran, nomor: 1, indikator: "Kelengkapan entitas", rincian: ["Semua entitas ada"], bobot: 50 },
        ],
        linimasa: [{ ...kotoran, minggu: 3, tahapan: "Pemilihan kasus", aktivitas: "Diskusi" }],
      },
    ],
  } as unknown as SumberProyeksi;
}

describe("dokumen publik", () => {
  it("membuang kisi-kisi ujian", () => {
    const dok = dokumenPublik(sumberKotor());
    assert.equal("kisiKisi" in dok, false);
    // "ESAI" hanya ada di bentuk butir soal — kalau muncul, kisi-kisi ikut terbawa.
    assert.doesNotMatch(JSON.stringify(dok), /ESAI/);
  });

  it("tetap membawa bagian yang memang dipublikasikan", () => {
    const dok = dokumenPublik(sumberKotor());
    assert.equal(dok.mataKuliah.kode, "TI214");
    assert.equal(dok.cpmk.length, 1);
    assert.equal(dok.pertemuan.length, 1);
    assert.equal(dok.tugas.length, 1);
    assert.equal(dok.pustaka.length, 3);
    assert.equal(dok.pengampu[0].nama, "Muhamad Yusuf");
  });

  /**
   * Penjaga yang sebenarnya. Kalau suatu hari `proyeksiIsi` diperluas dengan
   * `include` mentah dari Prisma, uji ini yang jatuh lebih dulu — sebelum
   * email dosen sempat terbit di halaman yang bisa diindeks Google.
   */
  it("tidak membawa id, email, maupun cap waktu ke luar", () => {
    const teks = JSON.stringify(dokumenPublik(sumberKotor()));

    for (const terlarang of [
      "clx0000000000000000000000",
      "clxpengguna0000000000000",
      "dosen@itts.ac.id",
      "2026-01-01",
      "2026-02-02",
    ]) {
      assert.equal(
        teks.includes(terlarang),
        false,
        `"${terlarang}" bocor ke dokumen publik`,
      );
    }

    for (const kunci of ["penggunaId", "dibuatPada", "diubahPada", "email"]) {
      assert.equal(
        teks.includes(`"${kunci}"`),
        false,
        `kunci "${kunci}" bocor ke dokumen publik`,
      );
    }
  });
});

describe("bantuan tampilan katalog", () => {
  it("peta Sub-CPMK menyambungkan kode ke rumusannya", () => {
    const peta = petaSubCpmk(dokumenPublik(sumberKotor()));
    assert.equal(peta.get("Sub-CPMK-2")?.rumusan, "Menyusun ERD.");
    assert.equal(peta.get("Sub-CPMK-99"), undefined);
  });

  it("pustaka dikelompokkan per jenis tanpa mengacak urutan nomor", () => {
    const kelompok = pustakaPerJenis(dokumenPublik(sumberKotor()));
    assert.deepEqual(
      kelompok.map(([jenis, daftar]) => [jenis, daftar.map((p) => p.nomor)]),
      [
        ["UTAMA", [1, 2]],
        ["PENDUKUNG", [3]],
      ],
    );
  });

  it("sks praktik nol tidak menampilkan pemecahan", () => {
    assert.equal(ringkasSks({ sksTeori: 3, sksPraktik: 0 }), "3 sks");
    assert.equal(ringkasSks({ sksTeori: 2, sksPraktik: 1 }), "3 sks (2T+1P)");
  });

  it("kode tahun akademik dibaca sebagai kalimat", () => {
    assert.equal(labelTahunAkademik("2025/2026-GENAP"), "2025/2026 Genap");
    assert.equal(labelTahunAkademik("tanpa-pola"), "tanpa Pola");
  });
});
