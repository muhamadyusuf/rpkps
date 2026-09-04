import type { TemuanBahanAjar } from "./tipe";

/**
 * Pemeriksaan berkas gambar raster — docs/17 §3.3 dan §5.3.
 *
 * Dua pemakai, dan keduanya sama-sama tidak dipercaya:
 *
 * 1. PNG yang dirasterkan PERAMBAN dari sebuah diagram. Peramban memang milik
 *    dosen, tetapi apa yang tiba di server tetap kiriman klien biasa — dan
 *    yang menulis ke basis data adalah server.
 * 2. Berkas yang diunggah dosen sendiri.
 *
 * Yang diperiksa adalah ANGKA AJAIB di kepala berkas, bukan nama maupun tipe
 * yang disebutkan pengirim. Berkas bernama `.png` yang isinya HTML adalah cara
 * tertua menyelundupkan halaman ke dalam sebuah situs, dan `Content-Type`
 * datang dari pengirim yang sama.
 *
 * Murni: tanpa Prisma, tanpa DOM. Bekerja di atas `Uint8Array`.
 */

export const BATAS_BYTE = 2 * 1024 * 1024;
export const BATAS_SISI = 3_000;

export type JenisRaster = "PNG" | "JPEG";

export interface HasilBerkasGambar {
  ok: boolean;
  temuan: TemuanBahanAjar[];
  jenis: JenisRaster | null;
  lebar: number | null;
  tinggi: number | null;
}

const AJAIB_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function periksaBerkasGambar(bita: Uint8Array): HasilBerkasGambar {
  const temuan: TemuanBahanAjar[] = [];
  const tolak = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PEMBLOKIR", ...(params ? { params } : {}) });
  };
  const gagal = (kode: string, params?: TemuanBahanAjar["params"]): HasilBerkasGambar => {
    tolak(kode, params);
    return { ok: false, temuan, jenis: null, lebar: null, tinggi: null };
  };

  if (bita.length === 0 || bita.length > BATAS_BYTE) {
    return gagal("IL-BERKAS-TERLALU-BESAR", { n: Math.round(BATAS_BYTE / 1024 / 1024) });
  }

  const jenis = kenaliJenis(bita);
  if (!jenis) return gagal("IL-BERKAS-BUKAN-GAMBAR");

  const ukuran = jenis === "PNG" ? ukuranPng(bita) : ukuranJpeg(bita);
  if (!ukuran) return gagal("IL-BERKAS-RUSAK");

  if (ukuran.lebar > BATAS_SISI || ukuran.tinggi > BATAS_SISI) {
    return gagal("IL-BERKAS-TERLALU-LEBAR", { n: BATAS_SISI });
  }

  return { ok: true, temuan, jenis, lebar: ukuran.lebar, tinggi: ukuran.tinggi };
}

/** Angka ajaib, bukan nama berkas dan bukan Content-Type. */
export function kenaliJenis(bita: Uint8Array): JenisRaster | null {
  if (bita.length >= 8 && AJAIB_PNG.every((b, i) => bita[i] === b)) return "PNG";
  // JPEG: SOI (FF D8) di kepala, EOI (FF D9) di ekor.
  if (bita.length >= 4 && bita[0] === 0xff && bita[1] === 0xd8 && bita[2] === 0xff) {
    return "JPEG";
  }
  return null;
}

/**
 * Ukuran PNG dari bongkah IHDR, yang menurut spesifikasi selalu bongkah
 * pertama: 8 bita tanda tangan, 4 panjang, 4 tipe, lalu lebar dan tinggi.
 */
function ukuranPng(b: Uint8Array): { lebar: number; tinggi: number } | null {
  if (b.length < 24) return null;
  const tipe = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (tipe !== "IHDR") return null;
  const baca = (i: number) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
  const lebar = baca(16) >>> 0;
  const tinggi = baca(20) >>> 0;
  return lebar > 0 && tinggi > 0 ? { lebar, tinggi } : null;
}

/**
 * Ukuran JPEG dengan menelusuri penanda sampai bertemu SOFn.
 *
 * JPEG tidak menaruh ukurannya di tempat tetap; ia harus dicari. Penanda
 * DHT/DQT dan kerabatnya dilewati menurut panjangnya sendiri.
 */
function ukuranJpeg(b: Uint8Array): { lebar: number; tinggi: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const penanda = b[i + 1];
    // SOF0..SOF15, kecuali DHT (C4), JPG (C8), dan DAC (CC).
    if (
      penanda >= 0xc0 &&
      penanda <= 0xcf &&
      penanda !== 0xc4 &&
      penanda !== 0xc8 &&
      penanda !== 0xcc
    ) {
      const tinggi = (b[i + 5] << 8) | b[i + 6];
      const lebar = (b[i + 7] << 8) | b[i + 8];
      return lebar > 0 && tinggi > 0 ? { lebar, tinggi } : null;
    }
    const panjang = (b[i + 2] << 8) | b[i + 3];
    if (panjang < 2) return null;
    i += 2 + panjang;
  }
  return null;
}

/**
 * Membaca `data:` URI yang dikirim peramban menjadi bita.
 *
 * Hanya menerima PNG. Peramban kita merasterkan dengan `canvas.toDataURL()`
 * yang selalu menghasilkan PNG; menerima jenis lain di sini berarti menerima
 * apa pun yang dikarang pengirim lain.
 */
export function bacaDataUriPng(uri: string): Uint8Array<ArrayBuffer> | null {
  const awalan = "data:image/png;base64,";
  if (!uri.startsWith(awalan)) return null;
  const b64 = uri.slice(awalan.length);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length === 0) return null;
  try {
    const biner = atob(b64);
    const bita = new Uint8Array(new ArrayBuffer(biner.length));
    for (let i = 0; i < biner.length; i++) bita[i] = biner.charCodeAt(i);
    return bita;
  } catch {
    return null;
  }
}
