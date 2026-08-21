import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma 7 mewajibkan driver adapter. Instance di-cache pada globalThis agar
 * hot-reload di mode dev tidak membuka koneksi baru setiap kali berkas berubah.
 *
 * JEBAKAN: cache ini bertahan melintasi hot-reload, termasuk ketika klien
 * Prisma diregenerasi. Setelah mengubah prisma/schema.prisma dan menjalankan
 * `prisma generate`, instance yang tersimpan di sini MASIH memakai skema
 * runtime yang lama — sementara definisi tipenya sudah baru, sehingga
 * typecheck lolos dan galat baru muncul saat dijalankan sebagai
 * "Unknown argument". Nyalakan ulang `npm run dev` setiap kali skema berubah.
 * Lihat klienBasi() di src/lib/galat-prisma.ts yang menerjemahkan gejalanya.
 */
const globalUntukPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function buatClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalUntukPrisma.prisma ?? buatClient();

if (process.env.NODE_ENV !== "production") {
  globalUntukPrisma.prisma = prisma;
}
