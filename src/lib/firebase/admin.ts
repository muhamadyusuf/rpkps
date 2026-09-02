import "server-only";
import { createHash } from "node:crypto";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "@/lib/env";
import { buatJadwalCabut } from "@/domain/firebase/cabut-sesi";

const NAMA_APP = "obe-admin";

function app(): App {
  const terpasang = getApps().find((a) => a.name === NAMA_APP);
  if (terpasang) return getApp(NAMA_APP);

  const { projectId, clientEmail, privateKey } = env.firebaseAdmin;
  return initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }) },
    NAMA_APP,
  );
}

export function adminAuth() {
  return getAuth(app());
}

/** Umur cookie sesi: 5 hari. Firebase membatasi maksimum 14 hari. */
export const UMUR_SESI_MS = 5 * 24 * 60 * 60 * 1000;

export async function buatCookieSesi(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: UMUR_SESI_MS });
}

/**
 * Jadwal pemeriksaan pencabutan. Kebijakannya — termasuk alasan mengapa
 * pemeriksaan jaringan tidak lagi terjadi tiap permintaan — ada di
 * `src/domain/firebase/cabut-sesi.ts` beserta pengujinya.
 *
 * Kuncinya SHA-256 cookie, bukan cookienya. Cookie sesi adalah kredensial
 * penuh; memakainya sebagai kunci peta membuatnya ikut terbaca pada heap dump.
 */
const jadwalCabut = buatJadwalCabut();

function sidikCookie(cookie: string): string {
  return createHash("sha256").update(cookie).digest("hex");
}

/**
 * Memverifikasi cookie sesi.
 *
 * Tanda tangan dan masa berlaku diperiksa setiap kali, secara lokal. Status
 * pencabutan di Firebase ditanyakan berkala — lihat `cabut-sesi.ts`.
 */
export async function verifikasiCookieSesi(
  cookie: string,
): Promise<DecodedIdToken | null> {
  const sekarang = Date.now();
  const sidik = sidikCookie(cookie);
  const periksaCabut = jadwalCabut.perluPeriksa(sidik, sekarang);

  try {
    const token = await adminAuth().verifySessionCookie(cookie, periksaCabut);
    // Dicatat hanya setelah berhasil: pemeriksaan yang gagal bukan pemeriksaan.
    if (periksaCabut) jadwalCabut.catat(sidik, sekarang);
    return token;
  } catch {
    // Cookie yang ditolak tidak boleh meninggalkan izin-lewat: kalau
    // penolakannya justru karena pencabutan, permintaan berikutnya akan
    // melewatkan pemeriksaan yang baru saja gagal.
    jadwalCabut.lupakan(sidik);
    return null;
  }
}

/**
 * Membuang izin-lewat milik satu cookie. Dipanggil saat keluar: cookienya
 * sudah dihapus dari peramban, jadi membiarkan entrinya menganggur sampai
 * kedaluwarsa hanya menahan jejak sesi yang sudah selesai.
 */
export function lupakanCookieSesi(cookie: string): void {
  jadwalCabut.lupakan(sidikCookie(cookie));
}
