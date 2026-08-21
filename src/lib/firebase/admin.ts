import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "@/lib/env";

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
 * `true` pada argumen kedua memaksa pengecekan status pencabutan ke Firebase.
 * Lebih lambat, tapi memastikan akun yang dinonaktifkan langsung kehilangan akses.
 */
export async function verifikasiCookieSesi(
  cookie: string,
): Promise<DecodedIdToken | null> {
  try {
    return await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}
