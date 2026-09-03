import "server-only";
import {
  buatBukuAjarDocx,
  namaBerkasBuku,
  type BukuUntukCetak,
  type OpsiCetakBuku,
} from "@/lib/dokumen/buku-ajar-docx";
import {
  buatSlidePptx,
  namaBerkasSlide,
  type DekUntukSlide,
  type OpsiSlide,
} from "@/lib/dokumen/slide-pptx";
import { muatBuku, type BukuLengkap } from "./muat";

/**
 * Menyiapkan berkas buku ajar beserta nama berkasnya — docs/16 §4.
 *
 * OTORISASI BUKAN URUSAN MODUL INI; rutenya yang memutuskan siapa boleh
 * mengunduh apa. Pola yang sama dengan `siapkan-unduhan.ts` untuk RPKPS.
 */

export type BerkasBuku = { buffer: Buffer; namaBerkas: string };

/**
 * Membaca kolom `glosarium` yang bertipe Json.
 *
 * Isinya ditulis `rapikanKelengkapan` dan karena itu selalu berbentuk benar —
 * tetapi kolom Json dapat memuat apa saja, termasuk sisa bentuk lama. Yang
 * tidak berbentuk pasangan istilah–arti dibuang diam-diam: glosarium yang
 * separuh rusak lebih baik daripada berkas yang gagal dicetak.
 */
export function bacaGlosarium(nilai: unknown): { istilah: string; arti: string }[] {
  if (!Array.isArray(nilai)) return [];
  return nilai.flatMap((x) => {
    if (typeof x !== "object" || x === null) return [];
    const g = x as Record<string, unknown>;
    if (typeof g.istilah !== "string" || typeof g.arti !== "string") return [];
    const istilah = g.istilah.trim();
    const arti = g.arti.trim();
    return istilah && arti ? [{ istilah, arti }] : [];
  });
}

export function keBukuCetak(buku: BukuLengkap): BukuUntukCetak {
  return {
    bahasa: buku.bahasa,
    judul: buku.judul,
    subjudul: buku.subjudul,
    penulis: buku.penulis,
    afiliasi: buku.afiliasi,
    penerbit: buku.penerbit,
    kotaTerbit: buku.kotaTerbit,
    tahunTerbit: buku.tahunTerbit,
    edisi: buku.edisi,
    isbn: buku.isbn,
    hakCipta: buku.hakCipta,
    prakata: buku.prakata,
    pendahuluan: buku.pendahuluan,
    glosarium: bacaGlosarium(buku.glosarium),
    biografi: buku.biografi,
    mataKuliah: {
      kode: buku.rpkps.mataKuliah.kode,
      // Nama Inggris dipakai bila bukunya berbahasa Inggris DAN nama itu ada;
      // nama Indonesia tetap yang sah, dan menjadi cadangannya.
      nama:
        (buku.bahasa === "en" ? buku.rpkps.mataKuliah.namaEn : null) ??
        buku.rpkps.mataKuliah.nama,
    },
    prodi: buku.rpkps.mataKuliah.kurikulum.prodi.nama,
    bab: buku.bab.map((b) => ({
      nomor: b.nomor,
      judul: b.judul,
      tujuan: b.tujuan,
      uraian: b.uraian,
      studiKasus: b.studiKasus,
      ringkasan: b.ringkasan,
      belumDisunting: b.disuntingPada === null,
      latihan: b.latihan.map((l) => ({ nomor: l.nomor, soal: l.soal, kunci: l.kunci })),
    })),
    /*
     * Daftar pustaka buku adalah daftar pustaka RPKPS, apa adanya — bukan
     * hanya yang kebetulan disitir sebuah bab, dan tidak pernah karangan model
     * (docs/16 P6).
     */
    pustaka: buku.rpkps.pustaka.map((p) => ({
      nomor: p.nomor,
      jenis: p.jenis,
      teks: p.teks,
    })),
  };
}

export async function siapkanUnduhanBuku(
  bukuId: string,
  opsi: OpsiCetakBuku = {},
): Promise<BerkasBuku | null> {
  const baris = await muatBuku(bukuId);
  if (!baris) return null;

  const buku = keBukuCetak(baris);
  if (opsi.bab !== undefined && !buku.bab.some((b) => b.nomor === opsi.bab)) return null;

  return {
    buffer: await buatBukuAjarDocx(buku, opsi),
    namaBerkas: namaBerkasBuku(buku, opsi),
  };
}

// ─────────────────────────────────────────────────────────────
// SLIDE — docs/16 §4.2
// ─────────────────────────────────────────────────────────────

/**
 * Bentuk dek slide dari sebuah buku.
 *
 * Perhatikan latihan yang dipetakan: HANYA nomor dan soalnya. `LatihanSlide`
 * memang tidak punya medan kunci — slide ditayangkan di depan kelas, dan
 * jawaban yang tersorot di layar tidak dapat ditarik kembali.
 */
export function keDekSlide(buku: BukuLengkap): DekUntukSlide {
  const cetak = keBukuCetak(buku);
  return {
    bahasa: cetak.bahasa,
    judulBuku: cetak.judul,
    penulis: cetak.penulis,
    mataKuliah: cetak.mataKuliah,
    bab: buku.bab.map((b) => ({
      nomor: b.nomor,
      judul: b.judul,
      tujuan: b.tujuan,
      slide: b.slide.map((s) => ({
        nomor: s.nomor,
        judul: s.judul,
        butir: s.butir,
        catatan: s.catatan,
      })),
      latihan: b.latihan.map((l) => ({ nomor: l.nomor, soal: l.soal })),
    })),
  };
}

export async function siapkanSlideBuku(
  bukuId: string,
  opsi: OpsiSlide = {},
): Promise<BerkasBuku | null> {
  const baris = await muatBuku(bukuId);
  if (!baris) return null;

  const dek = keDekSlide(baris);
  if (opsi.bab !== undefined && !dek.bab.some((b) => b.nomor === opsi.bab)) return null;

  return {
    buffer: await buatSlidePptx(dek, opsi),
    namaBerkas: namaBerkasSlide(dek, opsi),
  };
}
