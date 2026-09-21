/**
 * Identitas lembaga — logo, visi & misi, dan kontak — sebagaimana ia BOLEH
 * tersimpan. Acuan: docs/21 §2.2 dan §2.4.
 *
 * Murni: tanpa Prisma, tanpa React, tanpa `Buffer`. Yang masuk `Uint8Array`,
 * yang keluar keputusan. Itulah yang membuat aturan penerimaan logo dapat
 * diuji dengan dua puluh berkas cacat tanpa satu pun basis data.
 *
 * Kenapa dimensi dibaca sendiri alih-alih memakai pustaka gambar: yang
 * dibutuhkan hanya lebar dan tinggi dari dua format, dan keduanya menuliskannya
 * di kepala berkas. Menarik pustaka pengolah gambar ke jalur unggah berarti
 * menjalankan dekoder penuh atas bita yang baru saja datang dari peramban.
 */

/** Jenis yang diterima. SVG sengaja TIDAK ada di sini — lihat §2.2. */
export type TipeLogo = "image/png" | "image/jpeg";

export const BATAS_LOGO = {
  /** Lebih besar dari ini bukan logo, melainkan foto. */
  bita: 512 * 1024,
  /** Di bawah ini kop tercetak buram pada 2 cm. */
  pxMinimal: 128,
  /** Di atas ini tidak menambah ketajaman apa pun pada kertas. */
  pxMaksimal: 2000,
} as const;

export type LogoSah = {
  tipe: TipeLogo;
  lebar: number;
  tinggi: number;
};

/**
 * Sebab penolakan, sebagai KODE. Kalimatnya dirakit pemanggil dari kamus —
 * berkas ini tidak tahu bahasa apa yang sedang dipakai pengunggahnya.
 */
export type SebabTolakLogo =
  | "kosong"
  | "terlaluBesar"
  | "bukanGambar"
  | "terlaluKecil"
  | "terlaluLebar";

export type PeriksaLogo =
  | { ok: true; logo: LogoSah }
  | { ok: false; sebab: SebabTolakLogo };

const TANDA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Menimbang bita yang diunggah.
 *
 * Jenisnya diputuskan dari **bita ajaib**, bukan dari `File.type`: nama dan
 * `Content-Type` sebuah unggahan datang dari peramban dan dapat dikarang,
 * sehingga berkas apa pun dapat menyebut dirinya PNG. Yang ditanam ke berkas
 * DOCX nanti adalah bita ini, dan Word menolak seluruh dokumen bila isinya
 * ternyata bukan gambar — kegagalannya muncul jauh dari tempat sebabnya.
 */
export function periksaLogo(bita: Uint8Array): PeriksaLogo {
  if (bita.length === 0) return { ok: false, sebab: "kosong" };
  if (bita.length > BATAS_LOGO.bita) return { ok: false, sebab: "terlaluBesar" };

  const ukuran = ukuranPng(bita) ?? ukuranJpeg(bita);
  if (!ukuran) return { ok: false, sebab: "bukanGambar" };

  const { tipe, lebar, tinggi } = ukuran;
  if (lebar < BATAS_LOGO.pxMinimal || tinggi < BATAS_LOGO.pxMinimal) {
    return { ok: false, sebab: "terlaluKecil" };
  }
  if (lebar > BATAS_LOGO.pxMaksimal || tinggi > BATAS_LOGO.pxMaksimal) {
    return { ok: false, sebab: "terlaluLebar" };
  }

  return { ok: true, logo: { tipe, lebar, tinggi } };
}

function u32(bita: Uint8Array, i: number): number {
  return (
    ((bita[i]! << 24) | (bita[i + 1]! << 16) | (bita[i + 2]! << 8) | bita[i + 3]!) >>> 0
  );
}

/** PNG menaruh lebar dan tinggi di IHDR, yang selalu chunk pertama. */
function ukuranPng(bita: Uint8Array): LogoSah | null {
  if (bita.length < 24) return null;
  for (let i = 0; i < TANDA_PNG.length; i++) {
    if (bita[i] !== TANDA_PNG[i]) return null;
  }
  // 8..11 panjang chunk, 12..15 jenisnya, 16..19 lebar, 20..23 tinggi.
  if (
    bita[12] !== 0x49 ||
    bita[13] !== 0x48 ||
    bita[14] !== 0x44 ||
    bita[15] !== 0x52
  ) {
    return null;
  }
  const lebar = u32(bita, 16);
  const tinggi = u32(bita, 20);
  if (lebar === 0 || tinggi === 0) return null;
  return { tipe: "image/png", lebar, tinggi };
}

/**
 * JPEG tidak punya kepala tetap: ukurannya ada di penanda SOF, yang letaknya
 * bergantung pada berapa banyak segmen (EXIF, komentar, tabel kuantisasi)
 * mendahuluinya. Karena itu segmennya ditelusuri satu per satu.
 *
 * Penanda yang DILEWATI di sini adalah SOF4 (0xC4, tabel Huffman), SOF8
 * (0xC8, dicadangkan), dan SOF12 (0xCC, definisi aritmetik) — ketiganya
 * memakai rentang nomor yang sama tetapi bukan kepala bingkai.
 */
function ukuranJpeg(bita: Uint8Array): LogoSah | null {
  if (bita.length < 4 || bita[0] !== 0xff || bita[1] !== 0xd8) return null;

  let i = 2;
  while (i + 3 < bita.length) {
    if (bita[i] !== 0xff) {
      i++;
      continue;
    }
    const penanda = bita[i + 1]!;
    // Isian dan penanda tanpa muatan: lanjut tanpa membaca panjang.
    if (penanda === 0xff || (penanda >= 0xd0 && penanda <= 0xd9)) {
      i += 2;
      continue;
    }
    const panjang = (bita[i + 2]! << 8) | bita[i + 3]!;
    if (panjang < 2) return null;

    const kepalaBingkai =
      penanda >= 0xc0 &&
      penanda <= 0xcf &&
      penanda !== 0xc4 &&
      penanda !== 0xc8 &&
      penanda !== 0xcc;

    if (kepalaBingkai) {
      // i+4 presisi, i+5..6 tinggi, i+7..8 lebar.
      if (i + 8 >= bita.length) return null;
      const tinggi = (bita[i + 5]! << 8) | bita[i + 6]!;
      const lebar = (bita[i + 7]! << 8) | bita[i + 8]!;
      if (lebar === 0 || tinggi === 0) return null;
      return { tipe: "image/jpeg", lebar, tinggi };
    }

    i += 2 + panjang;
  }
  return null;
}

/**
 * Tinggi tampil sebuah logo pada lebar kolom yang sudah ditetapkan.
 *
 * Ada supaya pencetak tidak perlu membongkar bita lagi hanya untuk tahu
 * nisbahnya — dan supaya logo tidak pernah tercetak gepeng, yang adalah cara
 * tercepat membuat dokumen resmi terlihat seperti tempelan.
 */
export function tinggiSkala(logo: { lebar: number; tinggi: number }, lebarTampil: number): number {
  if (logo.lebar <= 0) return lebarTampil;
  return Math.round((logo.tinggi / logo.lebar) * lebarTampil);
}

/* ── Kontak ──────────────────────────────────────────────────────────── */

export const BATAS_TEKS = {
  visi: 1000,
  misiButir: 500,
  misiJumlah: 15,
  alamat: 300,
  telepon: 40,
  surel: 120,
  situs: 200,
} as const;

/**
 * Situs dirapikan, BUKAN ditebak. Skema yang hilang dilengkapi `https://`
 * karena itulah yang diketik orang; skema selain http/https ditolak — sebuah
 * `javascript:` yang lolos ke `href` tautan katalog publik adalah celah XSS
 * yang dipasang tangan sendiri.
 */
export function rapikanSitus(nilai: string): string | null {
  const bersih = nilai.trim();
  if (!bersih) return null;
  const lengkap = /^[a-z][a-z0-9+.-]*:/i.test(bersih) ? bersih : `https://${bersih}`;
  let url: URL;
  try {
    url = new URL(lengkap);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString().replace(/\/$/, "");
}

/**
 * Surel diperiksa sekadarnya. Yang dijaga bukan keabsahan alamatnya — itu
 * hanya terbukti dengan mengirim surat — melainkan bahwa yang tersimpan tetap
 * satu baris tanpa spasi, sehingga aman ditempel ke `mailto:` dan ke kop.
 */
export function rapikanSurel(nilai: string): string | null {
  const bersih = nilai.trim();
  if (!bersih) return null;
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(bersih)) return null;
  return bersih;
}

/**
 * Nomor telepon: angka dan tanda baca lazimnya saja, satu baris.
 *
 * Enam digit adalah lantainya — bukan aturan telekomunikasi, melainkan
 * penolakan terhadap "(021)" dan "ext. 12" yang tertinggal di formulir. Yang
 * tercetak di kop harus dapat ditelepon.
 */
export function rapikanTelepon(nilai: string): string | null {
  const bersih = nilai.trim().replace(/\s+/g, " ");
  if (!bersih) return null;
  if (!/^[+()\d\s./-]+$/.test(bersih)) return null;
  if ((bersih.match(/\d/g) ?? []).length < 6) return null;
  return bersih;
}

/**
 * Butir misi dibersihkan sebagai SATU larik: butir kosong dibuang dan sisanya
 * merapat, karena nomor cetaknya adalah posisinya. Menyimpan butir kosong di
 * tengah berarti "Misi 3" yang tidak berbunyi apa-apa pada berkas cetak.
 */
export function rapikanMisi(butir: readonly string[]): string[] {
  return butir
    .map((b) => b.trim().slice(0, BATAS_TEKS.misiButir))
    .filter((b) => b.length > 0)
    .slice(0, BATAS_TEKS.misiJumlah);
}
