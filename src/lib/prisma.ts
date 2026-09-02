import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma";

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

/**
 * Basis datanya jauh — Postgres terkelola di kawasan lain, bukan di mesin yang
 * sama. Dua angka menentukan hampir seluruh waktu tunggu aplikasi ini:
 *
 * - Membuka SATU koneksi baru (TCP + TLS + SCRAM) memakan ~500 ms.
 * - Satu perjalanan pulang-pergi kueri memakan ~25 ms.
 *
 * `idleTimeoutMillis` bawaan `pg` adalah 10 detik: koneksi menganggur ditutup,
 * dan permintaan berikutnya membayar ~500 ms lagi. Pada aplikasi internal yang
 * sepi — jeda antar-klik lebih panjang dari 10 detik — itu berarti HAMPIR
 * SETIAP halaman membayarnya. Kolam sengaja dibiarkan hidup.
 */
const KOLAM = {
  max: 10,
  /** 0 = jangan pernah menutup koneksi menganggur. Lihat catatan di atas. */
  idleTimeoutMillis: 0,
  /** Menahan NAT/pemuat-seimbang di jalan agar tidak memutus koneksi diam. */
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  /** Gagal cepat dan berpesan, alih-alih menggantung permintaan tanpa batas. */
  connectionTimeoutMillis: 15_000,
} as const;

/**
 * Operasi baca yang bentuk hasilnya dapat dirakit satu kueri.
 *
 * Tanpa ini Prisma memuat setiap relasi sebagai kueri terpisah: satu
 * `muatRpkps()` menjadi 30 perjalanan pulang-pergi. Dengan strategi `join`
 * seluruhnya menjadi satu — pada dokumen contoh, 30 kueri/136 ms turun menjadi
 * 1 kueri/74 ms, dan dalam keadaan dingin 662 ms menjadi 181 ms.
 *
 * Hanya operasi baca. Penulisan dibiarkan apa adanya: `join` tidak menambah
 * apa pun di sana, dan yang tidak diubah tidak dapat rusak.
 */
const BACA_RELASIONAL = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
]);

/**
 * `distinct` dan `join` tidak dapat hidup bersama — Prisma menolaknya. Kueri
 * seperti itu tetap memakai strategi bawaan.
 */
function bolehJoin(args: unknown): boolean {
  if (typeof args !== "object" || args === null) return false;
  const a = args as Record<string, unknown>;
  if ("distinct" in a) return false;
  if ("relationLoadStrategy" in a) return false;
  return "include" in a || "select" in a;
}

const strategiGabung = Prisma.defineExtension({
  name: "strategi-gabung",
  query: {
    $allModels: {
      $allOperations({ operation, args, query }) {
        if (BACA_RELASIONAL.has(operation) && bolehJoin(args)) {
          return query({ ...(args as object), relationLoadStrategy: "join" });
        }
        return query(args);
      },
    },
  },
});

function buatClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ...KOLAM,
  });
  const dasar = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return dasar.$extends(strategiGabung);
}

const globalUntukPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Sengaja bertipe `PrismaClient`, bukan tipe hasil `$extends`.
 *
 * Perluasan di atas tidak menambah satu pun model, medan, maupun metode — ia
 * hanya menyisipkan satu argumen sebelum kueri berangkat, sehingga permukaan
 * API-nya identik. Yang berbeda hanya `$on`, yang memang tidak dipakai di mana
 * pun dan tidak boleh dipakai: klien yang diperluas tidak memilikinya. Tanpa
 * penyeragaman tipe ini, `export type Klien = PrismaClient` di seluruh berkas
 * `*-inti.ts` — yang sengaja menerima kliennya sebagai parameter agar dapat
 * diuji di luar React — berhenti cocok, padahal objek yang dilewatkan sama.
 */
export const prisma =
  globalUntukPrisma.prisma ?? (buatClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalUntukPrisma.prisma = prisma;
}
