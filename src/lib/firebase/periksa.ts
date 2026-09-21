import "server-only";
import {
  tafsirkanResponsAuth,
  type HasilPeriksaAuth,
} from "@/domain/firebase/tafsir-auth";

export type { HasilPeriksaAuth };

/**
 * Memeriksa apakah Firebase Authentication benar-benar sudah diaktifkan pada
 * proyek, bukan sekadar apakah variabel lingkungannya terisi.
 *
 * API key web bersifat publik (ikut terkirim ke browser dan memang dirancang
 * demikian), jadi memakainya untuk memanggil Identity Toolkit — layanan
 * pemiliknya sendiri — tidak membocorkan apa pun.
 */
export async function periksaFirebaseAuth(): Promise<HasilPeriksaAuth> {
  // /setup terbuka tanpa login (ia harus terbuka: ia yang menjelaskan mengapa
  // masuk belum bisa). Tanpa cache, setiap kunjungan anonim memicu satu
  // panggilan keluar berbatas 6 detik — pintu untuk menahan koneksi server.
  const sekarang = Date.now();
  if (cache && sekarang - cache.pada < UMUR_CACHE_MS) return cache.hasil;
  const hasil = await periksaTanpaCache();
  cache = { pada: sekarang, hasil };
  return hasil;
}

const UMUR_CACHE_MS = 60_000;
let cache: { pada: number; hasil: HasilPeriksaAuth } | null = null;

async function periksaTanpaCache(): Promise<HasilPeriksaAuth> {
  const kunci = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!kunci) return { status: "tidak-diperiksa" };

  try {
    const respons = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(kunci)}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    const badan = await respons.json().catch(() => null);
    return tafsirkanResponsAuth(respons.status, badan);
  } catch (galat) {
    return {
      status: "tak-terjangkau",
      pesan: galat instanceof Error ? galat.message : "gagal menghubungi Firebase",
    };
  }
}
