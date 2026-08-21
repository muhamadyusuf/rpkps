import type { RpkpsInput } from "./tipe";

/**
 * Pemetaan dari bentuk baris database ke masukan validator.
 *
 * Tipe argumennya struktural, bukan tipe Prisma, supaya modul ini tetap murni
 * dan dapat dipakai baik dari server maupun dari skrip uji integrasi.
 */
export interface SumberRpkps {
  deskripsi: string | null;
  mataKuliah: {
    kode: string;
    nama: string;
    sksTeori: number;
    sksPraktik: number;
    cpl: { cpl: { kode: string } }[];
    cpmk: { subCpmk: { kode: string }[] }[];
  };
  pertemuan: {
    minggu: number;
    jenis: "EFEKTIF" | "UTS" | "UAS";
    topik: string | null;
    subtopik: string[];
    metodeNarasi: string | null;
    penilaianJenis: string | null;
    bobot: unknown;
    subCpmk: { subCpmk: { kode: string } }[];
    aktivitas: { nama: string; kategori: "TM" | "PT" | "BM"; menit: number }[];
    indikator: { teks: string }[];
    pustaka: { pustaka: { nomor: number } }[];
  }[];
  komponenNilai: { nama: string; bobot: unknown }[];
  tugas: {
    nomor: number;
    nama: string;
    mingguMulai: number;
    mingguSelesai: number;
    bobot: unknown;
    deskripsi: string;
    subCpmk: { subCpmk: { kode: string } }[];
    kriteria: { nomor: number; indikator: string; bobot: unknown }[];
    linimasa: unknown[];
  }[];
  pustaka: { jenis: string }[];
  pengampu: unknown[];
}

export function keRpkpsInput(r: SumberRpkps): RpkpsInput {
  return {
    mkKode: r.mataKuliah.kode,
    mkNama: r.mataKuliah.nama,
    sksTeori: r.mataKuliah.sksTeori,
    sksPraktik: r.mataKuliah.sksPraktik,
    deskripsi: r.deskripsi,
    cplKode: r.mataKuliah.cpl.map((m) => m.cpl.kode),
    subCpmkTersedia: r.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)),
    pertemuan: r.pertemuan.map((p) => ({
      minggu: p.minggu,
      jenis: p.jenis,
      topik: p.topik,
      subtopik: p.subtopik,
      metodeNarasi: p.metodeNarasi,
      penilaianJenis: p.penilaianJenis,
      bobot: Number(p.bobot),
      subCpmkKode: p.subCpmk.map((s) => s.subCpmk.kode),
      aktivitas: p.aktivitas.map((a) => ({
        nama: a.nama,
        kategori: a.kategori,
        menit: a.menit,
      })),
      indikator: p.indikator.map((i) => i.teks),
      pustakaNomor: p.pustaka.map((x) => x.pustaka.nomor),
    })),
    komponenNilai: r.komponenNilai.map((k) => ({ nama: k.nama, bobot: Number(k.bobot) })),
    tugas: r.tugas.map((t) => ({
      nomor: t.nomor,
      nama: t.nama,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      bobot: Number(t.bobot),
      deskripsi: t.deskripsi,
      subCpmkKode: t.subCpmk.map((s) => s.subCpmk.kode),
      kriteria: t.kriteria.map((k) => ({
        nomor: k.nomor,
        indikator: k.indikator,
        bobot: Number(k.bobot),
      })),
      jumlahLinimasa: t.linimasa.length,
    })),
    jumlahPustakaUtama: r.pustaka.filter((p) => p.jenis === "UTAMA").length,
    jumlahPengampu: r.pengampu.length,
  };
}

export function namaLengkapPengampu(p: {
  nama: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
}): string {
  return [p.gelarDepan, p.nama, p.gelarBelakang].filter(Boolean).join(" ");
}
