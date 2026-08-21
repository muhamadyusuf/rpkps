/**
 * Penerjemah galat Prisma menjadi kalimat yang dapat ditindaklanjuti pengguna.
 *
 * Dipakai bersama oleh aksi yang menulis banyak baris sekaligus. Tanpa ini
 * setiap aksi berakhir pada "periksa log server", yang memaksa siapa pun
 * membuka terminal untuk tahu apakah masalahnya skema, data bentrok, atau
 * klien yang basi.
 */

export function kodePrisma(galat: unknown): string | null {
  return typeof galat === "object" && galat !== null && "code" in galat
    ? String((galat as { code: unknown }).code)
    : null;
}

/** Mengambil baris paling menjelaskan dari pesan Prisma yang bertele-tele. */
export function intiPesanPrisma(pesan: string): string {
  const baris = pesan
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  const penting =
    baris.find((b) => b.startsWith("Argument") || b.startsWith("Unknown argument")) ??
    baris.find((b) => b.startsWith("Invalid `prisma.")) ??
    baris[baris.length - 1];
  return (penting ?? "").slice(0, 200);
}

/**
 * Mendeteksi klien Prisma yang tertinggal dari skema.
 *
 * `Unknown argument` pada field yang jelas-jelas ada di schema.prisma hampir
 * selalu berarti satu hal di mode dev: instance Prisma yang di-cache pada
 * globalThis dibuat SEBELUM klien diregenerasi. Definisi tipe di disk sudah
 * baru — sehingga typecheck lolos — tetapi skema runtime yang dipegang
 * instance itu masih yang lama. Memuat ulang halaman tidak menolong; server
 * dev yang harus dinyalakan ulang.
 */
export function klienBasi(galat: unknown): boolean {
  return (
    galat instanceof Error &&
    galat.constructor.name === "PrismaClientValidationError" &&
    /Unknown argument/.test(galat.message)
  );
}

export const PESAN_KLIEN_BASI =
  "Klien Prisma tertinggal dari skema — biasanya karena server dev masih " +
  "memegang klien lama sejak sebelum `prisma generate`. Nyalakan ulang " +
  "`npm run dev`, lalu coba lagi.";
