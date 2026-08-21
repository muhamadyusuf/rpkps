import { hitungSidik } from "./sidik";

/**
 * Proyeksi ISI dokumen — hanya yang tercetak, tanpa id maupun cap waktu.
 *
 * Dipakai untuk menghitung sidik. Kalau id dan `diubahPada` ikut di-hash,
 * sidik berubah setiap kali baris disentuh meski isinya sama persis,
 * sehingga deteksi pergeseran jadi tidak berarti.
 */

/**
 * Bentuk masukan proyeksi. Ditulis berdiri sendiri, bukan memperluas
 * SumberRpkps, karena intersection tidak menggabungkan tipe elemen array —
 * `cpl: A[] & cpl: B[]` menghasilkan elemen yang tidak punya properti keduanya.
 */
export interface SumberProyeksi {
  deskripsi: string | null;
  kalimatPembukaCpmk: string | null;
  ambangKelulusanMhs: unknown;
  ambangKetercapaianMk: unknown;
  minimalKehadiranPersen: number;
  tahunAkademik: { kode: string };
  mataKuliah: {
    kode: string;
    nama: string;
    semester: number;
    status: string;
    sksTeori: number;
    sksPraktik: number;
    cpl: { cpl: { kode: string; deskripsi: string } }[];
    cpmk: {
      kode: string;
      rumusan: string;
      levelBloom: string | null;
      cpl: { cpl: { kode: string } }[];
      subCpmk: { kode: string; rumusan: string; levelBloom: string | null }[];
    }[];
  };
  pengampu: { peran: string; pengguna: { nama: string; nidn: string | null } }[];
  pustaka: { jenis: string; nomor: number; teks: string; url: string | null }[];
  komponenNilai: { nama: string; bobot: unknown }[];
  pertemuan: {
    minggu: number;
    jenis: string;
    topik: string | null;
    subtopik: string[];
    metodeNarasi: string | null;
    aktivitasDosen: string | null;
    aktivitasMahasiswa: string | null;
    tugasTerstruktur: string | null;
    penilaianJenis: string | null;
    penilaianSistem: string | null;
    bobot: unknown;
    subCpmk: { subCpmk: { kode: string } }[];
    aktivitas: { nama: string; kategori: string; menit: number }[];
    indikator: { teks: string }[];
    pustaka: { pustaka: { nomor: number } }[];
  }[];
  kisiKisi: {
    jenis: string;
    totalSkor: unknown;
    durasiMenit: number | null;
    catatan: string | null;
    butir: {
      nomor: number;
      subCpmk: { kode: string };
      levelBloom: string;
      bentuk: string;
      jumlahButir: number;
      skor: unknown;
      indikator: string | null;
    }[];
  }[];
  tugas: {
    nomor: number;
    nama: string;
    jenis: string;
    mingguMulai: number;
    mingguSelesai: number;
    bobot: unknown;
    deskripsi: string;
    uraianTugas: string | null;
    formatLuaran: string | null;
    ketentuanLain: string | null;
    subCpmk: { subCpmk: { kode: string } }[];
    kriteria: { nomor: number; indikator: string; rincian: string[]; bobot: unknown }[];
    linimasa: { minggu: number; tahapan: string; aktivitas: string }[];
  }[];
}

export function proyeksiIsi(r: SumberProyeksi) {
  return {
    mataKuliah: {
      kode: r.mataKuliah.kode,
      nama: r.mataKuliah.nama,
      semester: r.mataKuliah.semester,
      status: r.mataKuliah.status,
      sksTeori: r.mataKuliah.sksTeori,
      sksPraktik: r.mataKuliah.sksPraktik,
    },
    tahunAkademik: r.tahunAkademik.kode,
    deskripsi: r.deskripsi,
    kalimatPembukaCpmk: r.kalimatPembukaCpmk,
    ambangKelulusanMhs: Number(r.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(r.ambangKetercapaianMk),
    minimalKehadiranPersen: r.minimalKehadiranPersen,

    cpl: r.mataKuliah.cpl.map((m) => ({
      kode: m.cpl.kode,
      deskripsi: m.cpl.deskripsi,
    })),
    cpmk: r.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      rumusan: c.rumusan,
      levelBloom: c.levelBloom,
      cpl: c.cpl.map((x) => x.cpl.kode),
      subCpmk: c.subCpmk.map((s) => ({
        kode: s.kode,
        rumusan: s.rumusan,
        levelBloom: s.levelBloom,
      })),
    })),

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
      nama: k.nama,
      bobot: Number(k.bobot),
    })),

    pertemuan: r.pertemuan.map((p) => ({
      minggu: p.minggu,
      jenis: p.jenis,
      topik: p.topik,
      subtopik: p.subtopik,
      metodeNarasi: p.metodeNarasi,
      aktivitasDosen: p.aktivitasDosen,
      aktivitasMahasiswa: p.aktivitasMahasiswa,
      tugasTerstruktur: p.tugasTerstruktur,
      penilaianJenis: p.penilaianJenis,
      penilaianSistem: p.penilaianSistem,
      bobot: Number(p.bobot),
      subCpmk: p.subCpmk.map((s) => s.subCpmk.kode),
      aktivitas: p.aktivitas.map((a) => ({
        nama: a.nama,
        kategori: a.kategori,
        menit: a.menit,
      })),
      indikator: p.indikator.map((i) => i.teks),
      pustaka: p.pustaka.map((x) => x.pustaka.nomor),
    })),

    // Kisi-kisi ikut tercetak sebagai lampiran, jadi harus ikut di-sidik —
    // tanpa ini dua dokumen dengan ujian berbeda menghasilkan sidik yang sama.
    kisiKisi: r.kisiKisi.map((k) => ({
      jenis: k.jenis,
      totalSkor: Number(k.totalSkor),
      durasiMenit: k.durasiMenit,
      catatan: k.catatan,
      butir: k.butir.map((b) => ({
        nomor: b.nomor,
        subCpmk: b.subCpmk.kode,
        levelBloom: b.levelBloom,
        bentuk: b.bentuk,
        jumlahButir: b.jumlahButir,
        skor: Number(b.skor),
        indikator: b.indikator,
      })),
    })),

    tugas: r.tugas.map((t) => ({
      nomor: t.nomor,
      nama: t.nama,
      jenis: t.jenis,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      bobot: Number(t.bobot),
      deskripsi: t.deskripsi,
      uraianTugas: t.uraianTugas,
      formatLuaran: t.formatLuaran,
      ketentuanLain: t.ketentuanLain,
      subCpmk: t.subCpmk.map((s) => s.subCpmk.kode),
      kriteria: t.kriteria.map((k) => ({
        nomor: k.nomor,
        indikator: k.indikator,
        rincian: k.rincian,
        bobot: Number(k.bobot),
      })),
      linimasa: t.linimasa.map((l) => ({
        minggu: l.minggu,
        tahapan: l.tahapan,
        aktivitas: l.aktivitas,
      })),
    })),
  };
}

/** Sidik dokumen: SHA-256 atas proyeksi isi yang sudah dikanonikkan. */
export function sidikDokumen(r: SumberProyeksi): string {
  return hitungSidik(proyeksiIsi(r));
}
