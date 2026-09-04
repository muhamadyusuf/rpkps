/**
 * Peta nama Prisma → nama SQL untuk kolom terjemahan isi RPKPS (docs/11 §8).
 */

/**
 * Tabel dan kolom `*En` isi RPKPS yang boleh ditulis, dalam KEDUA penamaan.
 *
 * Daftar putih, bukan penguraian bebas: alamat datang dari klien, dan sebuah
 * alamat yang diurai apa adanya menjadi `UPDATE <tabel> SET <kolom>` adalah
 * tulis-apa-saja-ke-mana-saja. Yang boleh ditulis hanya kolom terjemahan, dan
 * hanya pada tabel yang memang milik RPKPS ini.
 *
 * Nama SQL ikut ditulis di sini karena penerapannya memakai satu kueri jamak
 * per kolom (lihat `terapkanTerjemahan`), dan `Prisma.raw` tidak tahu apa-apa
 * tentang `@map`. Duplikasi nama adalah harga yang dibayar untuk itu —
 * dijaga `terjemahan-sql.test.ts` di sebelahnya, yang membaca `schema.prisma`
 * dan menolak nama yang menyimpang.
 *
 * Berkas ini SENGAJA terpisah dari `aksi-terjemahan.ts`: berkas `"use server"`
 * hanya boleh mengekspor fungsi async, jadi konstanta yang perlu dibaca uji
 * tidak dapat tinggal di sana. Ia juga tanpa `server-only` — isinya data,
 * bukan akses basis data.
 *
 * `rpkps.catatan_evaluasi` sengaja TIDAK punya kembaran di sini, sejalan
 * dengan migrasi L4: kolom itu belum punya penulis maupun pembaca satu pun,
 * jadi terjemahannya tak akan pernah dapat diisi siapa pun (docs/11 §5.1a).
 */
export interface IzinMedan {
  tabel: string;
  /** Kolom `String?` biasa: satu alamat, satu nilai. */
  kolom: Record<string, string>;
  /**
   * Kolom `String[]`. Alamatnya berindeks (`…:subtopikEn#2`) dan penulisannya
   * mengganti SELURUH larik, karena Postgres tidak dapat menulis satu elemen
   * tanpa meninggalkan NULL di posisi yang belum terisi — dan `String[]`
   * Prisma tidak dapat membaca larik ber-NULL.
   */
  larik?: Record<string, string>;
}

export const MEDAN_BOLEH: Record<string, IzinMedan> = {
  rpkps: {
    tabel: "rpkps",
    kolom: {
      deskripsiEn: "deskripsi_en",
      kalimatPembukaCpmkEn: "kalimat_pembuka_cpmk_en",
    },
  },
  pertemuan: {
    tabel: "pertemuan",
    kolom: {
      topikEn: "topik_en",
      metodeNarasiEn: "metode_narasi_en",
      aktivitasDosenEn: "aktivitas_dosen_en",
      aktivitasMahasiswaEn: "aktivitas_mahasiswa_en",
      tugasTerstrukturEn: "tugas_terstruktur_en",
      penilaianJenisEn: "penilaian_jenis_en",
      penilaianSistemEn: "penilaian_sistem_en",
    },
    larik: { subtopikEn: "subtopik_en" },
  },
  indikator: { tabel: "indikator", kolom: { teksEn: "teks_en" } },
  aktivitasBelajar: { tabel: "aktivitas_belajar", kolom: { namaEn: "nama_en" } },
  komponenNilai: { tabel: "komponen_nilai", kolom: { namaEn: "nama_en" } },
  tugas: {
    tabel: "tugas",
    kolom: {
      namaEn: "nama_en",
      deskripsiEn: "deskripsi_en",
      uraianTugasEn: "uraian_tugas_en",
      formatLuaranEn: "format_luaran_en",
      ketentuanLainEn: "ketentuan_lain_en",
    },
  },
  kriteriaTugas: {
    tabel: "kriteria_tugas",
    kolom: { indikatorEn: "indikator_en" },
    larik: { rincianEn: "rincian_en" },
  },
  linimasaTugas: {
    tabel: "linimasa_tugas",
    kolom: { tahapanEn: "tahapan_en", aktivitasEn: "aktivitas_en" },
  },
  kisiKisi: { tabel: "kisi_kisi", kolom: { catatanEn: "catatan_en" } },
  butirKisiKisi: { tabel: "butir_kisi_kisi", kolom: { indikatorEn: "indikator_en" } },
};
