import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Angka ringkas papan Perangkap. Empat hitungan yang saling bebas, jadi satu
 * `Promise.all` — basis datanya jauh (AGENTS.md), dan `await` berurutan di sini
 * langsung terasa.
 *
 * "IP berbeda" dihitung `distinct` di basis data: memuat baris lalu
 * menyaringnya di JavaScript tumbuh bersama umur aplikasi.
 */
export async function ringkasPerangkap() {
  const sehariLalu = new Date(Date.now() - 24 * 60 * 60_000);
  const [total, baru, duaEmpat, ipUnik] = await Promise.all([
    prisma.perangkapTemuan.count(),
    prisma.perangkapTemuan.count({ where: { status: "BARU" } }),
    prisma.perangkapTemuan.count({ where: { terakhirPada: { gte: sehariLalu } } }),
    prisma.perangkapTemuan
      .findMany({
        where: { terakhirPada: { gte: sehariLalu } },
        distinct: ["ip"],
        select: { ip: true },
        take: 5000,
      })
      .then((r) => r.length),
  ]);
  return { total, baru, duaEmpat, ipUnik };
}
