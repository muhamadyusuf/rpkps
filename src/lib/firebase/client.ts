"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from "firebase/auth";

/**
 * Firebase hanya dipakai sebagai penyedia identitas (login Google).
 * Profil kepegawaian — NIDN/NIP, peran, prodi — tetap berada di database
 * milik institusi, bukan di Firebase. Lihat docs/00 §4.2.
 */
const konfigurasi = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseTerkonfigurasi(): boolean {
  return Boolean(konfigurasi.apiKey && konfigurasi.authDomain && konfigurasi.projectId);
}

function app(): FirebaseApp {
  if (!firebaseTerkonfigurasi()) {
    throw new Error(
      "Konfigurasi Firebase belum lengkap. Lengkapi NEXT_PUBLIC_FIREBASE_* di .env",
    );
  }
  return getApps().length ? getApp() : initializeApp(konfigurasi);
}

export function auth(): Auth {
  return getAuth(app());
}

/**
 * Login Google, lalu tukar ID token dengan cookie sesi HttpOnly di server.
 * ID token tidak pernah disimpan di localStorage — cookie HttpOnly tidak
 * dapat dibaca skrip, sehingga aman dari pencurian token lewat XSS.
 */
export async function masukDenganGoogle(): Promise<{ bahasa: string | null }> {
  const penyedia = new GoogleAuthProvider();
  penyedia.setCustomParameters({ prompt: "select_account" });

  const kredensial = await signInWithPopup(auth(), penyedia);
  const idToken = await kredensial.user.getIdToken();

  const respons = await fetch("/api/sesi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!respons.ok) {
    await firebaseSignOut(auth());
    const galat = await respons.json().catch(() => ({ pesan: "Gagal membuat sesi." }));
    throw new Error(galat.pesan ?? "Gagal membuat sesi.");
  }

  // Bahasa yang tersimpan pada akun. Halaman masuk boleh saja dibuka dalam
  // bahasa lain — yang menentukan setelah masuk adalah preferensi orangnya.
  const isi = await respons.json().catch(() => ({}));
  return { bahasa: typeof isi?.bahasa === "string" ? isi.bahasa : null };
}

export async function keluar(): Promise<void> {
  await fetch("/api/sesi", { method: "DELETE" });
  await firebaseSignOut(auth());
}
