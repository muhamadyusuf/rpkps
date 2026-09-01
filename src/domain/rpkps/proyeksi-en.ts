import { hitungSidik } from "./sidik";

/**
 * Ruang sidik KEDUA: proyeksi isi berbahasa Inggris.
 *
 * Berdiri sendiri, dan itulah seluruh alasan keberadaannya. `proyeksiIsi()`
 * adalah dasar sidik setiap RPKPS terbit; menambahkan satu medan `*En` ke sana
 * menggeser sidik SELURUH arsip yang sudah ditandatangani. Polanya sama dengan
 * `src/domain/evaluasi/proyeksi.ts`, yang lahir dari alasan yang sama persis.
 *
 * Dua sidik, dua dokumen. Versi Indonesia tetap yang sah dan yang
 * ditandatangani; versi Inggris adalah terjemahan resmi yang diterbitkan
 * berdampingan, dengan sidiknya sendiri supaya pergeseran isinya juga dapat
 * dideteksi.
 *
 * Yang TIDAK diterjemahkan ikut apa adanya — kode mata kuliah, kode CPL/CPMK,
 * nomor pustaka, nama orang, angka. Menerjemahkan pengenal justru memutus
 * penelusuran antara kedua versi.
 */

/**
 * Bentuk masukan proyeksi Inggris.
 *
 * Ditulis BERDIRI SENDIRI, tidak memperluas `SumberProyeksi`, dengan alasan
 * yang sudah tercatat di sana: intersection tidak menggabungkan tipe elemen
 * array — `cpl: A[] & cpl: B[]` menghasilkan elemen yang tidak punya properti
 * keduanya. Duplikasinya disengaja dan lebih murah daripada tipe yang
 * berbohong.
 */
export interface SumberProyeksiEn {
  deskripsi: string | null;
  deskripsiEn: string | null;
  kalimatPembukaCpmk: string | null;
  kalimatPembukaCpmkEn: string | null;
  ambangKelulusanMhs: unknown;
  ambangKetercapaianMk: unknown;
  minimalKehadiranPersen: number;
  tahunAkademik: { kode: string };
  mataKuliah: {
    kode: string;
    nama: string;
    namaEn: string | null;
    semester: number;
    status: string;
    sksTeori: number;
    sksPraktik: number;
    cpl: { cpl: { kode: string; deskripsi: string; deskripsiEn: string | null } }[];
    cpmk: {
      kode: string;
      rumusan: string;
      rumusanEn: string | null;
      levelBloom: string | null;
      cpl: { cpl: { kode: string } }[];
      subCpmk: {
        kode: string;
        rumusan: string;
        rumusanEn: string | null;
        levelBloom: string | null;
      }[];
    }[];
  };
  pengampu: { peran: string; pengguna: { nama: string; nidn: string | null } }[];
  pustaka: { jenis: string; nomor: number; teks: string; url: string | null }[];
  komponenNilai: { nama: string; namaEn: string | null; bobot: unknown }[];
  pertemuan: {
    minggu: number;
    jenis: string;
    topik: string | null;
    topikEn: string | null;
    subtopik: string[];
    subtopikEn: string[];
    metodeNarasi: string | null;
    metodeNarasiEn: string | null;
    aktivitasDosen: string | null;
    aktivitasDosenEn: string | null;
    aktivitasMahasiswa: string | null;
    aktivitasMahasiswaEn: string | null;
    tugasTerstruktur: string | null;
    tugasTerstrukturEn: string | null;
    penilaianJenis: string | null;
    penilaianJenisEn: string | null;
    penilaianSistem: string | null;
    penilaianSistemEn: string | null;
    bobot: unknown;
    subCpmk: { subCpmk: { kode: string } }[];
    aktivitas: { nama: string; namaEn: string | null; kategori: string; menit: number }[];
    indikator: { teks: string; teksEn: string | null }[];
    pustaka: { pustaka: { nomor: number } }[];
  }[];
  kisiKisi: {
    jenis: string;
    totalSkor: unknown;
    durasiMenit: number | null;
    catatan: string | null;
    catatanEn: string | null;
    butir: {
      nomor: number;
      subCpmk: { kode: string };
      levelBloom: string;
      bentuk: string;
      jumlahButir: number;
      skor: unknown;
      indikator: string | null;
      indikatorEn: string | null;
    }[];
  }[];
  tugas: {
    nomor: number;
    nama: string;
    namaEn: string | null;
    jenis: string;
    mingguMulai: number;
    mingguSelesai: number;
    bobot: unknown;
    deskripsi: string;
    deskripsiEn: string | null;
    uraianTugas: string | null;
    uraianTugasEn: string | null;
    formatLuaran: string | null;
    formatLuaranEn: string | null;
    ketentuanLain: string | null;
    ketentuanLainEn: string | null;
    subCpmk: { subCpmk: { kode: string } }[];
    kriteria: {
      nomor: number;
      indikator: string;
      indikatorEn: string | null;
      rincian: string[];
      rincianEn: string[];
      bobot: unknown;
    }[];
    linimasa: {
      minggu: number;
      tahapan: string;
      tahapanEn: string | null;
      aktivitas: string;
      aktivitasEn: string | null;
    }[];
  }[];
}

/**
 * Teks Inggris, dengan cadangan ke Indonesia.
 *
 * Arahnya satu — sama seperti `pilihTeks` di lapisan bahasa. Dokumen Inggris
 * yang separuh medannya kosong tidak berguna bagi siapa pun; yang belum
 * diterjemahkan tampil apa adanya, dan halaman publik menerangkan keadaan itu
 * sekali di kepala dokumen, bukan pada tiap baris (docs/11 §5.4).
 */
function en(asal: string, terjemahan: string | null | undefined): string;
function en(asal: string | null, terjemahan: string | null | undefined): string | null;
function en(asal: string | null, terjemahan: string | null | undefined): string | null {
  // Berkelebihan (overload) supaya bentuk hasilnya sama persis dengan
  // `proyeksiIsi`: medan yang di sana `string` tidak boleh menjadi
  // `string | null` di sini, atau `DokumenPublik` berhenti memuat keduanya.
  const t = terjemahan?.trim() ?? "";
  return t.length > 0 ? t : asal;
}

/** Bentuk daftar dari `en()`. Daftar kosong dihitung belum diterjemahkan. */
function enDaftar(asal: string[], terjemahan: readonly string[] | undefined): string[] {
  const t = (terjemahan ?? []).filter((x) => x.trim().length > 0);
  return t.length > 0 ? [...t] : asal;
}

export function proyeksiIsiEn(r: SumberProyeksiEn) {
  return {
    mataKuliah: {
      kode: r.mataKuliah.kode,
      nama: en(r.mataKuliah.nama, r.mataKuliah.namaEn),
      semester: r.mataKuliah.semester,
      status: r.mataKuliah.status,
      sksTeori: r.mataKuliah.sksTeori,
      sksPraktik: r.mataKuliah.sksPraktik,
    },
    tahunAkademik: r.tahunAkademik.kode,
    deskripsi: en(r.deskripsi, r.deskripsiEn),
    kalimatPembukaCpmk: en(r.kalimatPembukaCpmk, r.kalimatPembukaCpmkEn),
    ambangKelulusanMhs: Number(r.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(r.ambangKetercapaianMk),
    minimalKehadiranPersen: r.minimalKehadiranPersen,

    cpl: r.mataKuliah.cpl.map((m) => ({
      kode: m.cpl.kode,
      deskripsi: en(m.cpl.deskripsi, m.cpl.deskripsiEn),
    })),
    cpmk: r.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      rumusan: en(c.rumusan, c.rumusanEn),
      levelBloom: c.levelBloom,
      cpl: c.cpl.map((x) => x.cpl.kode),
      subCpmk: c.subCpmk.map((s) => ({
        kode: s.kode,
        rumusan: en(s.rumusan, s.rumusanEn),
        levelBloom: s.levelBloom,
      })),
    })),

    // Nama orang, NIDN, dan entri pustaka TIDAK diterjemahkan: judul buku yang
    // diterjemahkan membuat sitasinya tidak dapat dilacak.
    pengampu: r.pengampu.map((p) => ({
      nama: p.pengguna.nama,
      nidn: p.pengguna.nidn,
      peran: p.peran,
    })),
    pustaka: r.pustaka.map((p) => ({
      jenis: p.jenis,
      nomor: p.nomor,
      teks: p.teks,
      url: p.url,
    })),
    komponenNilai: r.komponenNilai.map((k) => ({
      nama: en(k.nama, k.namaEn),
      bobot: Number(k.bobot),
    })),

    pertemuan: r.pertemuan.map((p) => ({
      minggu: p.minggu,
      jenis: p.jenis,
      topik: en(p.topik, p.topikEn),
      subtopik: enDaftar(p.subtopik, p.subtopikEn),
      metodeNarasi: en(p.metodeNarasi, p.metodeNarasiEn),
      aktivitasDosen: en(p.aktivitasDosen, p.aktivitasDosenEn),
      aktivitasMahasiswa: en(p.aktivitasMahasiswa, p.aktivitasMahasiswaEn),
      tugasTerstruktur: en(p.tugasTerstruktur, p.tugasTerstrukturEn),
      penilaianJenis: en(p.penilaianJenis, p.penilaianJenisEn),
      penilaianSistem: en(p.penilaianSistem, p.penilaianSistemEn),
      bobot: Number(p.bobot),
      subCpmk: p.subCpmk.map((s) => s.subCpmk.kode),
      aktivitas: p.aktivitas.map((a) => ({
        nama: en(a.nama, a.namaEn),
        kategori: a.kategori,
        menit: a.menit,
      })),
      indikator: p.indikator.map((i) => en(i.teks, i.teksEn)),
      pustaka: p.pustaka.map((x) => x.pustaka.nomor),
    })),

    kisiKisi: r.kisiKisi.map((k) => ({
      jenis: k.jenis,
      totalSkor: Number(k.totalSkor),
      durasiMenit: k.durasiMenit,
      catatan: en(k.catatan, k.catatanEn),
      butir: k.butir.map((b) => ({
        nomor: b.nomor,
        subCpmk: b.subCpmk.kode,
        levelBloom: b.levelBloom,
        bentuk: b.bentuk,
        jumlahButir: b.jumlahButir,
        skor: Number(b.skor),
        indikator: en(b.indikator, b.indikatorEn),
      })),
    })),

    tugas: r.tugas.map((t) => ({
      nomor: t.nomor,
      nama: en(t.nama, t.namaEn),
      jenis: t.jenis,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      bobot: Number(t.bobot),
      deskripsi: en(t.deskripsi, t.deskripsiEn),
      uraianTugas: en(t.uraianTugas, t.uraianTugasEn),
      formatLuaran: en(t.formatLuaran, t.formatLuaranEn),
      ketentuanLain: en(t.ketentuanLain, t.ketentuanLainEn),
      subCpmk: t.subCpmk.map((s) => s.subCpmk.kode),
      kriteria: t.kriteria.map((k) => ({
        nomor: k.nomor,
        indikator: en(k.indikator, k.indikatorEn),
        rincian: enDaftar(k.rincian, k.rincianEn),
        bobot: Number(k.bobot),
      })),
      linimasa: t.linimasa.map((l) => ({
        minggu: l.minggu,
        tahapan: en(l.tahapan, l.tahapanEn),
        aktivitas: en(l.aktivitas, l.aktivitasEn),
      })),
    })),
  };
}

/** Sidik dokumen berbahasa Inggris. Ruang terpisah dari `sidikDokumen`. */
export function sidikDokumenEn(r: SumberProyeksiEn): string {
  return hitungSidik(proyeksiIsiEn(r));
}
