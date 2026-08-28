import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Enkripsi amplop AES-256-GCM untuk rahasia yang harus dapat dibuka kembali —
 * saat ini hanya kunci API milik dosen. Acuan: docs/08 §3, docs/01 §2.3.
 *
 * Murni: tidak menyentuh Prisma, React, maupun process.env. KEK diserahkan
 * pemanggil, sehingga berkas ini dapat diuji tanpa menyiapkan lingkungan.
 *
 * Dua lapis, bukan satu. Kunci API disegel DEK acak miliknya sendiri; DEK itu
 * yang disegel KEK. Konsekuensinya rotasi KEK cukup membuka dan membungkus
 * ulang bagian DEK — 61 bita per baris — tanpa menyentuh cipherteks kuncinya.
 *
 * GCM dipilih supaya gumpalan yang berubah satu bita GAGAL dibuka, bukan
 * menghasilkan sampah yang diam-diam dikirim ke penyedia sebagai "kunci".
 */

const VERSI = 1;
const PANJANG_KUNCI = 32;
const PANJANG_IV = 12;
const PANJANG_TAG = 16;

/*
 * Tata letak gumpalan — lihat docs/08 §3.
 *   [0]        versi
 *   [1..13)    iv pembungkus DEK
 *   [13..29)   tag pembungkus DEK
 *   [29..61)   DEK terbungkus
 *   [61..73)   iv kunci API
 *   [73..89)   tag kunci API
 *   [89.. ]    kunci API terenkripsi
 */
const AWAL_IV_DEK = 1;
const AWAL_TAG_DEK = AWAL_IV_DEK + PANJANG_IV;
const AWAL_DEK = AWAL_TAG_DEK + PANJANG_TAG;
const AWAL_IV_ISI = AWAL_DEK + PANJANG_KUNCI;
const AWAL_TAG_ISI = AWAL_IV_ISI + PANJANG_IV;
const AWAL_ISI = AWAL_TAG_ISI + PANJANG_TAG;

export class GalatKripto extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "GalatKripto";
  }
}

/** Membaca KEK 32 bita dari teks base64. Melempar bila panjangnya salah. */
export function bacaKek(base64: string): Buffer {
  let kek: Buffer;
  try {
    kek = Buffer.from(base64.trim(), "base64");
  } catch {
    throw new GalatKripto("Kunci master bukan base64 yang sah.");
  }
  if (kek.length !== PANJANG_KUNCI) {
    throw new GalatKripto(
      `Kunci master harus ${PANJANG_KUNCI} bita (base64 dari 32 bita acak), bukan ${kek.length}.`,
    );
  }
  return kek;
}

function segel(kunci: Buffer, isi: Buffer): { iv: Buffer; tag: Buffer; sandi: Buffer } {
  const iv = randomBytes(PANJANG_IV);
  const mesin = createCipheriv("aes-256-gcm", kunci, iv);
  const sandi = Buffer.concat([mesin.update(isi), mesin.final()]);
  return { iv, tag: mesin.getAuthTag(), sandi };
}

function bukaSegel(kunci: Buffer, iv: Buffer, tag: Buffer, sandi: Buffer): Buffer {
  const mesin = createDecipheriv("aes-256-gcm", kunci, iv);
  mesin.setAuthTag(tag);
  return Buffer.concat([mesin.update(sandi), mesin.final()]);
}

export function bungkus(kek: Buffer, rahasia: string): Buffer {
  if (kek.length !== PANJANG_KUNCI) {
    throw new GalatKripto("Kunci master harus 32 bita.");
  }
  if (rahasia.length === 0) throw new GalatKripto("Rahasia kosong tidak dibungkus.");

  const dek = randomBytes(PANJANG_KUNCI);
  const isi = segel(dek, Buffer.from(rahasia, "utf8"));
  const amplop = segel(kek, dek);

  return Buffer.concat([
    Buffer.from([VERSI]),
    amplop.iv,
    amplop.tag,
    amplop.sandi,
    isi.iv,
    isi.tag,
    isi.sandi,
  ]);
}

export function buka(kek: Buffer, gumpalan: Buffer): string {
  if (kek.length !== PANJANG_KUNCI) {
    throw new GalatKripto("Kunci master harus 32 bita.");
  }
  if (gumpalan.length <= AWAL_ISI) {
    throw new GalatKripto("Gumpalan kredensial terlalu pendek atau rusak.");
  }
  if (gumpalan[0] !== VERSI) {
    throw new GalatKripto(`Versi gumpalan ${gumpalan[0]} tidak dikenal.`);
  }

  try {
    const dek = bukaSegel(
      kek,
      gumpalan.subarray(AWAL_IV_DEK, AWAL_TAG_DEK),
      gumpalan.subarray(AWAL_TAG_DEK, AWAL_DEK),
      gumpalan.subarray(AWAL_DEK, AWAL_IV_ISI),
    );
    const rahasia = bukaSegel(
      dek,
      gumpalan.subarray(AWAL_IV_ISI, AWAL_TAG_ISI),
      gumpalan.subarray(AWAL_TAG_ISI, AWAL_ISI),
      gumpalan.subarray(AWAL_ISI),
    );
    return rahasia.toString("utf8");
  } catch (galat) {
    // Pesannya sengaja tidak membedakan "KEK salah" dari "gumpalan diutak-atik".
    // Keduanya berakhir sama: kunci ini tidak dapat dipakai.
    if (galat instanceof GalatKripto) throw galat;
    throw new GalatKripto(
      "Kredensial tidak dapat dibuka. Kunci master berganti, atau barisnya rusak — daftarkan ulang kunci API Anda.",
    );
  }
}

/**
 * Empat karakter terakhir kunci, disimpan terpisah sebagai teks biasa supaya
 * dosen dapat mengenali kunci yang mana tanpa membukanya. Empat karakter tidak
 * cukup untuk memakai kunci mana pun.
 */
export function ekorKunci(rahasia: string): string {
  return rahasia.trim().slice(-4);
}

/** Perbandingan tanpa kebocoran waktu, untuk uji kesetaraan rahasia. */
export function samaAman(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
