import { hitungSidik } from "@/domain/rpkps/sidik";
import type { CapaianButir, NilaiMahasiswa } from "./capaian";
import type { Asesmen } from "./peta-asesmen";

/**
 * Proyeksi isi evaluasi — dasar salinan beku dan sidiknya (doc 05 §5.5).
 *
 * Ruangnya TERPISAH SAMA SEKALI dari `src/domain/rpkps/proyeksi.ts`. Hasil
 * evaluasi tidak boleh ikut ke sana: menambah apa pun ke proyeksi RPKPS akan
 * menggeser sidik SELURUH RPKPS terbit dan memunculkan peringatan pergeseran
 * palsu — aturan yang sama yang melindungi profil lulusan (AGENTS.md).
 *
 * Seperti proyeksi RPKPS, isinya hanya yang BERMAKNA: tanpa id, tanpa cap
 * waktu. Kalau tidak, sidik berubah setiap kali baris disentuh meski isinya
 * sama persis, dan pembekuan jadi tidak berarti.
 */

export interface SumberProyeksiEvaluasi {
  mk: { kode: string; nama: string };
  tahunAkademik: string;
  kelas: string;
  dosen: string | null;
  ambangKelulusanMhs: number;
  ambangKetercapaianMk: number;
  catatanProses: string | null;
  asesmen: readonly Asesmen[];
  butir: readonly CapaianButir[];
  mahasiswa: readonly NilaiMahasiswa[];
  temuan: readonly {
    tingkat: string;
    kode: string;
    capaianTerukur: number | null;
    akarMasalah: string;
    tindakan: string;
    penanggungJawab: string | null;
    taSasaran: string | null;
  }[];
}

export function proyeksiEvaluasi(s: SumberProyeksiEvaluasi) {
  return {
    mk: { kode: s.mk.kode, nama: s.mk.nama },
    tahunAkademik: s.tahunAkademik,
    kelas: s.kelas,
    dosen: s.dosen,
    ambang: {
      kelulusanMhs: s.ambangKelulusanMhs,
      ketercapaianMk: s.ambangKetercapaianMk,
    },
    catatanProses: s.catatanProses,
    // Peta asesmen ikut dibekukan: tanpa bobot yang berlaku saat itu, angka
    // capaian tidak dapat diperiksa ulang oleh siapa pun.
    asesmen: [...s.asesmen]
      .map((a) => ({
        kode: a.kode,
        nama: a.nama,
        komponen: a.komponen,
        bobot: a.bobot,
        subCpmk: [...a.subCpmk]
          .map((b) => ({ kode: b.kode, bobot: b.bobot }))
          .sort((x, y) => x.kode.localeCompare(y.kode)),
      }))
      .sort((x, y) => x.kode.localeCompare(y.kode)),
    butir: [...s.butir]
      .map((b) => ({
        tingkat: b.tingkat,
        kode: b.kode,
        rerata: b.rerata,
        persenLulus: b.persenLulus,
        tercapai: b.tercapai,
        pita: b.pita,
        jumlahDinilai: b.jumlahDinilai,
      }))
      .sort((x, y) => `${x.tingkat}|${x.kode}`.localeCompare(`${y.tingkat}|${y.kode}`)),
    mahasiswa: [...s.mahasiswa]
      .map((m) => ({
        nim: m.nim,
        nama: m.nama,
        subCpmk: m.subCpmk,
        cpmk: m.cpmk,
        cpl: m.cpl,
        nilaiAkhir: m.nilaiAkhir,
      }))
      .sort((x, y) => x.nim.localeCompare(y.nim)),
    temuan: [...s.temuan].sort((x, y) =>
      `${x.tingkat}|${x.kode}`.localeCompare(`${y.tingkat}|${y.kode}`),
    ),
  };
}

export type IsiEvaluasi = ReturnType<typeof proyeksiEvaluasi>;

export function sidikEvaluasi(s: SumberProyeksiEvaluasi): string {
  return hitungSidik(proyeksiEvaluasi(s));
}
