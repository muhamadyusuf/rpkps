import { daftarRingkas } from "@/domain/temuan";
import { LEVEL_BLOOM, type LevelBloom } from "@/domain/kurikulum/bloom";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Merapikan keluaran model menjadi bentuk yang siap disimpan — docs/16 §3.
 *
 * Pola yang sama dengan `alokasikanAsesmen` (docs/12 §3.3): **rapikan
 * memperbaiki, validator membuktikan.** Yang dikerjakan di sini deterministik,
 * dan setiap perbaikan yang mengubah keluaran model dilaporkan sebagai temuan
 * `INFO` — bukan disembunyikan. Dosen menyetujui bab dengan satu tombol, jadi
 * ia berhak tahu bagian mana yang bukan lagi tulisan model.
 *
 * Murni: tanpa Prisma, tanpa React, tanpa zod. Bentuk mentahnya sengaja
 * ditulis ulang sebagai antarmuka biasa supaya domain tidak bergantung pada
 * skema keluaran di `src/lib/ai` — arah ketergantungannya satu arah, seperti
 * `DrafRpkps` terhadap `skema-draf.ts`.
 *
 * # Sentinel, bukan null
 *
 * Skema keluaran tidak mengenal `null` (lihat kepala `skema-draf.ts`): isian
 * kosong diwakili string kosong. Modul inilah yang menerjemahkannya kembali
 * menjadi `null` — satu tempat, bukan di setiap pemanggil.
 */

const SAH_BLOOM: ReadonlySet<string> = new Set(LEVEL_BLOOM.map((l) => l.level));

// ─────────────────────────────────────────────────────────────
// BENTUK MENTAH — cerminan skema keluaran, bukan baris database
// ─────────────────────────────────────────────────────────────

export interface LatihanMentah {
  soal: string;
  kunci: string;
  bloom: string;
}

export interface BabMentah {
  uraian: string;
  studi_kasus: string;
  ringkasan: string;
  latihan: LatihanMentah[];
  sitiran: number[];
}

export interface SlideMentah {
  judul: string;
  butir: string[];
  catatan: string;
}

export interface KelengkapanMentah {
  prakata: string;
  pendahuluan: string;
  glosarium: { istilah: string; arti: string }[];
  biografi: string;
}

// ─────────────────────────────────────────────────────────────
// BENTUK SIAP SIMPAN
// ─────────────────────────────────────────────────────────────

export interface LatihanSiap {
  nomor: number;
  soal: string;
  kunci: string | null;
  bloom: LevelBloom | null;
}

export interface IsiBabSiap {
  uraian: string | null;
  studiKasus: string | null;
  ringkasan: string | null;
  latihan: LatihanSiap[];
  sitiran: number[];
}

export interface SlideSiap {
  nomor: number;
  judul: string;
  butir: string[];
  catatan: string | null;
}

export interface KelengkapanSiap {
  prakata: string | null;
  pendahuluan: string | null;
  glosarium: { istilah: string; arti: string }[];
  biografi: string | null;
}

export interface Dirapikan<T> {
  hasil: T;
  /** Perbaikan yang mengubah keluaran model. Kosong berarti tidak ada. */
  catatan: TemuanBahanAjar[];
}

// ─────────────────────────────────────────────────────────────

export function rapikanIsiBab(
  mentah: BabMentah,
  opsi: { nomorPustakaTersedia: readonly number[]; bab?: number },
): Dirapikan<IsiBabSiap> {
  const catatan: TemuanBahanAjar[] = [];
  const bab = opsi.bab;

  const latihan: LatihanSiap[] = [];
  let latihanDibuang = 0;
  const bloomAsing = new Set<string>();

  for (const l of mentah.latihan ?? []) {
    const soal = teks(l.soal);
    // Soal kosong bukan latihan. Menyimpannya menghasilkan nomor yang
    // melompat di buku dan baris kosong di halaman latihan.
    if (!soal) {
      latihanDibuang++;
      continue;
    }
    const bloom = teks(l.bloom)?.toUpperCase();
    if (bloom && !SAH_BLOOM.has(bloom)) bloomAsing.add(bloom);

    latihan.push({
      nomor: latihan.length + 1,
      soal,
      kunci: teks(l.kunci),
      bloom: bloom && SAH_BLOOM.has(bloom) ? (bloom as LevelBloom) : null,
    });
  }

  if (latihanDibuang > 0) {
    catatan.push({
      kode: "BA-LATIHAN-KOSONG-DIBUANG",
      tingkat: "INFO",
      params: { jumlah: latihanDibuang },
      bab,
    });
  }
  if (bloomAsing.size > 0) {
    catatan.push({
      kode: "BA-BLOOM-ASING",
      tingkat: "INFO",
      params: { daftar: daftarRingkas([...bloomAsing].sort()) },
      bab,
    });
  }

  /*
   * Sitiran yang menunjuk pustaka di luar daftar RPKPS DIBUANG di sini, bukan
   * dibiarkan sampai validator (docs/16 P6). Daftar pustaka buku dirakit dari
   * baris `pustaka`, jadi sitiran asing akan menggantung di teks tanpa padanan
   * di halaman daftar pustaka — dan `BA-PUSTAKA-ASING` pada validator karena
   * itu semestinya tidak pernah menyala untuk keluaran AI. Bila ia menyala,
   * yang bocor adalah jalur ini.
   */
  const tersedia = new Set(opsi.nomorPustakaTersedia);
  const sitiran: number[] = [];
  const dibuang = new Set<number>();
  for (const nomor of mentah.sitiran ?? []) {
    if (!Number.isInteger(nomor)) continue;
    if (!tersedia.has(nomor)) {
      dibuang.add(nomor);
      continue;
    }
    if (!sitiran.includes(nomor)) sitiran.push(nomor);
  }
  sitiran.sort((a, b) => a - b);

  if (dibuang.size > 0) {
    const nomor = [...dibuang].sort((a, b) => a - b);
    catatan.push({
      kode: "BA-SITIRAN-DIBUANG",
      tingkat: "INFO",
      params: { jumlah: nomor.length, daftar: daftarRingkas(nomor.map(String)) },
      bab,
    });
  }

  return {
    hasil: {
      uraian: teks(mentah.uraian),
      studiKasus: teks(mentah.studi_kasus),
      ringkasan: teks(mentah.ringkasan),
      latihan,
      sitiran,
    },
    catatan,
  };
}

export function rapikanSlide(
  mentah: readonly SlideMentah[],
  opsi: { bab?: number } = {},
): Dirapikan<SlideSiap[]> {
  const catatan: TemuanBahanAjar[] = [];
  const slide: SlideSiap[] = [];
  let dibuang = 0;

  for (const s of mentah ?? []) {
    const judul = teks(s.judul);
    const butir = (s.butir ?? []).map((b) => teks(b)).filter((b): b is string => b !== null);

    // Slide tanpa judul DAN tanpa butir tidak menampilkan apa pun.
    if (!judul && butir.length === 0) {
      dibuang++;
      continue;
    }

    slide.push({
      nomor: slide.length + 1,
      judul: judul ?? "",
      butir,
      catatan: teks(s.catatan),
    });
  }

  if (dibuang > 0) {
    catatan.push({
      kode: "BA-SLIDE-KOSONG-DIBUANG",
      tingkat: "INFO",
      params: { jumlah: dibuang },
      bab: opsi.bab,
    });
  }

  return { hasil: slide, catatan };
}

export function rapikanKelengkapan(mentah: KelengkapanMentah): Dirapikan<KelengkapanSiap> {
  const catatan: TemuanBahanAjar[] = [];

  const glosarium: { istilah: string; arti: string }[] = [];
  const terlihat = new Set<string>();
  let ganda = 0;

  for (const g of mentah.glosarium ?? []) {
    const istilah = teks(g.istilah);
    const arti = teks(g.arti);
    if (!istilah || !arti) continue;

    // Istilah yang sama dua kali dengan arti berbeda adalah glosarium yang
    // membingungkan; yang pertama menang, yang kedua dilaporkan.
    const kunci = istilah.toLocaleLowerCase("id");
    if (terlihat.has(kunci)) {
      ganda++;
      continue;
    }
    terlihat.add(kunci);
    glosarium.push({ istilah, arti });
  }

  glosarium.sort((a, b) => a.istilah.localeCompare(b.istilah, "id"));

  if (ganda > 0) {
    catatan.push({
      kode: "BA-GLOSARIUM-GANDA",
      tingkat: "INFO",
      params: { jumlah: ganda },
    });
  }

  return {
    hasil: {
      prakata: teks(mentah.prakata),
      pendahuluan: teks(mentah.pendahuluan),
      glosarium,
      biografi: teks(mentah.biografi),
    },
    catatan,
  };
}

/**
 * Sentinel model menjadi `null`.
 *
 * Selain string kosong, model kadang menuliskan "-", "null", atau "tidak ada"
 * sebagai penanda kosong meski panduan melarangnya. Ketiganya diperlakukan
 * sebagai kosong: satu tanda hubung yang tersimpan sebagai ringkasan bab akan
 * tercetak di buku persis seperti itu.
 */
function teks(nilai: string | null | undefined): string | null {
  const bersih = (nilai ?? "").trim();
  if (!bersih) return null;
  if (/^([-\u2010-\u2015]+|null|n\/a|tidak ada|none)$/i.test(bersih)) return null;
  return bersih;
}
