import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Pengirim surel — docs/10 §2.5 (tahap N5).
 *
 * Satu-satunya tempat kredensial SMTP dibaca, dan satu-satunya tempat koneksi
 * SMTP dibuka. Alasannya sama dengan `src/lib/ai/kredensial.ts`: kredensial
 * yang boleh dibaca dari banyak tempat cepat atau lambat akan tercetak di
 * salah satunya.
 *
 * **Kanal ini mati secara bawaan.** Tanpa env SMTP, `kanalSurelMenyala()`
 * mengembalikan `false` dan seluruh notifikasi ditandai `DILEWATI` saat
 * ditulis — bukan `MENUNGGU` yang menumpuk menunggu konfigurasi yang mungkin
 * tidak pernah datang.
 *
 * Disetel untuk Gmail (surel kampus ITTS berjalan di Google):
 *
 *   SUREL_SMTP_HOST=smtp.gmail.com
 *   SUREL_SMTP_PORT=587
 *   SUREL_SMTP_PENGGUNA=rpkps@itts.ac.id
 *   SUREL_SMTP_SANDI=<App Password 16 huruf, BUKAN sandi akun>
 *   SUREL_DARI="RPKPS ITTS <rpkps@itts.ac.id>"
 *
 * Tiga hal khas Gmail yang wajib diketahui sebelum menyalakannya:
 *
 *  1. **App Password menuntut verifikasi dua langkah aktif** pada akun itu.
 *     Sandi akun biasa ditolak sejak Google mematikan "less secure apps".
 *  2. **Alamat `SUREL_DARI` harus akun itu sendiri atau aliasnya.** Gmail
 *     menulis ulang `From` yang bukan miliknya, dan balasan akan menuju alamat
 *     yang salah.
 *  3. **Ada kuota harian** — Workspace ±2.000 penerima/hari per akun. Untuk
 *     kiriman yang lebih besar, ganti host ke `smtp-relay.gmail.com` (relay
 *     Workspace) tanpa mengubah satu baris pun di sini.
 */

export interface KonfigurasiSmtp {
  host: string;
  port: number;
  pengguna: string;
  sandi: string;
  dari: string;
}

function baca(nama: string): string | undefined {
  const nilai = process.env[nama];
  return nilai && nilai.trim() !== "" ? nilai.trim() : undefined;
}

/**
 * Konfigurasi SMTP bila lengkap. Sengaja mengembalikan `null` alih-alih
 * melempar: kanal yang belum disetel adalah keadaan yang sah, bukan galat.
 */
export function konfigurasiSmtp(): KonfigurasiSmtp | null {
  const host = baca("SUREL_SMTP_HOST");
  const pengguna = baca("SUREL_SMTP_PENGGUNA");
  const sandi = baca("SUREL_SMTP_SANDI");
  if (!host || !pengguna || !sandi) return null;

  return {
    host,
    port: Number(baca("SUREL_SMTP_PORT") ?? 587),
    pengguna,
    sandi,
    // Bawaannya akun pengirim itu sendiri — satu-satunya nilai yang pasti
    // diterima Gmail tanpa penulisan ulang.
    dari: baca("SUREL_DARI") ?? pengguna,
  };
}

export function kanalSurelMenyala(): boolean {
  return konfigurasiSmtp() !== null;
}

/**
 * Nilai yang tidak boleh muncul di log maupun di kolom galat. Dipakai
 * `ringkasGalat` — pesan bawaan beberapa server SMTP menyertakan nama akun.
 */
export function rahasiaSmtp(): string[] {
  const k = konfigurasiSmtp();
  return k ? [k.sandi, k.pengguna] : [];
}

/**
 * Transport dibuat SEKALI per proses dan disimpan pada `globalThis`.
 *
 * Bukan penghematan sepele: tiap koneksi SMTP baru ke Gmail membayar jabat
 * tangan TLS beserta autentikasinya, dan kuras antrian mengirim berpuluh surel
 * berurutan. `pool: true` membuat nodemailer memakai ulang koneksinya.
 *
 * Berbeda dari klien AI yang HARAM disimpan di variabel modul (kunci di sana
 * milik dosen yang berbeda-beda) — kredensial SMTP di sini satu untuk seluruh
 * institusi, jadi menyimpannya justru benar.
 */
const global_ = globalThis as unknown as { transportSurel?: Transporter };

function transport(k: KonfigurasiSmtp): Transporter {
  if (!global_.transportSurel) {
    global_.transportSurel = nodemailer.createTransport({
      host: k.host,
      port: k.port,
      // 465 memakai TLS langsung; 587 mulai polos lalu naik lewat STARTTLS.
      secure: k.port === 465,
      auth: { user: k.pengguna, pass: k.sandi },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
    });
  }
  return global_.transportSurel;
}

export interface Surel {
  ke: string;
  subjek: string;
  teks: string;
}

/**
 * Mengirim satu surel. Melempar bila gagal — pemanggilnya (`kurasAntrianSurel`)
 * yang memutuskan mencoba ulang atau menyerah.
 */
export async function kirimSurel(surel: Surel): Promise<void> {
  const k = konfigurasiSmtp();
  if (!k) throw new Error("Kanal surel belum dikonfigurasi.");

  await transport(k).sendMail({
    from: k.dari,
    to: surel.ke,
    subject: surel.subjek,
    text: surel.teks,
  });
}
