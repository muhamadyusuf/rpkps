/**
 * Menerjemahkan kode galat Firebase Auth menjadi pesan yang menyebutkan
 * apa yang harus dilakukan, bukan sekadar apa yang salah.
 *
 * Kode-kode ini muncul sebagai properti `code` pada FirebaseError.
 */

export interface PesanGalat {
  pesan: string;
  langkah?: string[];
  /** Galat yang tidak perlu dilaporkan — pengguna sendiri yang membatalkan. */
  diam?: boolean;
}

const PETA: Record<string, PesanGalat> = {
  "auth/configuration-not-found": {
    pesan: "Authentication belum diaktifkan pada proyek Firebase ini.",
    langkah: [
      "Buka Firebase Console → pilih proyek Anda.",
      'Menu Authentication → klik tombol "Get started".',
      'Tab "Sign-in method" → pilih Google → aktifkan → Save.',
      "Muat ulang halaman ini, lalu coba masuk lagi.",
    ],
  },
  "auth/operation-not-allowed": {
    pesan: "Penyedia login Google belum diaktifkan.",
    langkah: [
      "Firebase Console → Authentication → Sign-in method.",
      "Pilih Google → aktifkan → tentukan email dukungan proyek → Save.",
    ],
  },
  "auth/unauthorized-domain": {
    pesan: "Domain ini belum terdaftar sebagai domain yang diizinkan.",
    langkah: [
      "Firebase Console → Authentication → Settings → Authorized domains.",
      'Tambahkan "localhost" untuk pengembangan, dan domain produksi Anda.',
    ],
  },
  "auth/invalid-api-key": {
    pesan: "NEXT_PUBLIC_FIREBASE_API_KEY tidak dikenali proyek ini.",
    langkah: [
      "Firebase Console → Project settings → General → Your apps → Web app.",
      "Salin ulang seluruh nilai konfigurasi ke .env, lalu jalankan ulang npm run dev.",
    ],
  },
  "auth/popup-blocked": {
    pesan: "Jendela login diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.",
  },
  "auth/network-request-failed": {
    pesan: "Gagal menghubungi Firebase. Periksa koneksi internet Anda.",
  },
  "auth/popup-closed-by-user": { pesan: "", diam: true },
  "auth/cancelled-popup-request": { pesan: "", diam: true },
  "auth/user-disabled": {
    pesan: "Akun ini dinonaktifkan. Hubungi administrator.",
  },
};

export function terjemahkanGalatAuth(galat: unknown): PesanGalat {
  const kode =
    typeof galat === "object" && galat !== null && "code" in galat
      ? String((galat as { code: unknown }).code)
      : "";

  if (kode && PETA[kode]) return PETA[kode];

  const pesan =
    galat instanceof Error && galat.message ? galat.message : "Gagal masuk. Coba lagi.";
  return { pesan: kode ? `${pesan} (${kode})` : pesan };
}
