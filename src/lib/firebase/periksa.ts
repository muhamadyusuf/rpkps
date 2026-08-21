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
