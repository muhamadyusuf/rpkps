import "server-only";

/**
 * Pembacaan variabel lingkungan yang gagal dengan pesan jelas, bukan `undefined`
 * yang menyebar diam-diam. Semua akses env di sisi server lewat sini.
 */

function baca(nama: string): string | undefined {
  const nilai = process.env[nama];
  return nilai && nilai.trim() !== "" ? nilai : undefined;
}

function wajib(nama: string): string {
  const nilai = baca(nama);
  if (!nilai) {
    throw new Error(
      `Variabel lingkungan ${nama} belum diisi. Salin .env.example menjadi .env lalu lengkapi.`,
    );
  }
  return nilai;
}

/** Daftar env yang dibutuhkan tiap bagian aplikasi, untuk halaman /setup. */
export const KEBUTUHAN_ENV = {
  database: ["DATABASE_URL"],
  firebaseKlien: [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ],
  firebaseAdmin: [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ],
} as const;

export type BagianEnv = keyof typeof KEBUTUHAN_ENV;

export function statusEnv(): Record<BagianEnv, { siap: boolean; kurang: string[] }> {
  const hasil = {} as Record<BagianEnv, { siap: boolean; kurang: string[] }>;
  for (const [bagian, daftar] of Object.entries(KEBUTUHAN_ENV) as [
    BagianEnv,
    readonly string[],
  ][]) {
    const kurang = daftar.filter((nama) => !baca(nama));
    hasil[bagian] = { siap: kurang.length === 0, kurang };
  }
  return hasil;
}

export function semuaEnvSiap(): boolean {
  return Object.values(statusEnv()).every((s) => s.siap);
}

/** DATABASE_URL placeholder dari .env.example dianggap belum dikonfigurasi. */
export function databaseTerkonfigurasi(): boolean {
  const url = baca("DATABASE_URL");
  return Boolean(url) && !url!.includes("placeholder");
}

export const env = {
  get databaseUrl() {
    return wajib("DATABASE_URL");
  },
  get firebaseAdmin() {
    return {
      projectId: wajib("FIREBASE_PROJECT_ID"),
      clientEmail: wajib("FIREBASE_CLIENT_EMAIL"),
      // Private key dari JSON service account memuat "\n" literal
      // ketika ditulis satu baris di dalam .env.
      privateKey: wajib("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    };
  },
  get adminBootstrapEmails(): string[] {
    return (baca("ADMIN_BOOTSTRAP_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
};
