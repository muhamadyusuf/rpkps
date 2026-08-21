/**
 * Penafsiran respons Identity Toolkit menjadi status yang dapat ditindaklanjuti.
 * Dipisahkan dari pemanggilan jaringan agar dapat diuji tanpa proyek Firebase
 * yang sengaja dirusak.
 */

export type HasilPeriksaAuth =
  | { status: "aktif"; domainDiizinkan: string[] }
  | { status: "belum-aktif" }
  | { status: "kunci-salah" }
  | { status: "tak-terjangkau"; pesan: string }
  | { status: "tidak-diperiksa" };

export function tafsirkanResponsAuth(
  kodeHttp: number,
  badan: unknown,
): HasilPeriksaAuth {
  if (kodeHttp >= 200 && kodeHttp < 300) {
    const data = badan as { authorizedDomains?: string[] } | null;
    return { status: "aktif", domainDiizinkan: data?.authorizedDomains ?? [] };
  }

  const pesan =
    (badan as { error?: { message?: string } } | null)?.error?.message ?? "";

  // Authentication belum pernah diaktifkan di Firebase Console — penyebab
  // paling umum galat auth/configuration-not-found pada tombol masuk.
  if (pesan.includes("CONFIGURATION_NOT_FOUND")) return { status: "belum-aktif" };
  if (pesan.includes("API_KEY_INVALID") || pesan.includes("API key not valid")) {
    return { status: "kunci-salah" };
  }
  return { status: "tak-terjangkau", pesan: pesan || `HTTP ${kodeHttp}` };
}
