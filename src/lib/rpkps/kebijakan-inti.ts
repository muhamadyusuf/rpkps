import { KEBIJAKAN_BAWAAN } from "@/domain/beban-belajar/kebijakan-bawaan";
import type { Kebijakan } from "@/domain/beban-belajar/tipe";
import type { PrismaClient } from "@/generated/prisma";

/**
 * Pemuat kebijakan beban belajar yang menerima klien Prisma sebagai PARAMETER.
 *
 * Alasannya sama dengan `lib/kurikulum/usulan-inti.ts`: `@/lib/prisma`
 * menandai dirinya `server-only`, yang melempar galat di luar lingkungan
 * React — termasuk di `uji/integrasi.ts`. Logika yang perlu dijalankan
 * keduanya harus menerima kliennya, bukan mengimpornya.
 */

export type Klien = PrismaClient;

export async function muatKebijakanDari(
  db: Klien,
): Promise<{ kebijakan: Kebijakan; dariDatabase: boolean }> {
  const baris = await db.kebijakanBebanBelajar.findFirst({
    orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
    include: { bentuk: true },
  });

  if (!baris || baris.bentuk.length === 0) {
    return { kebijakan: KEBIJAKAN_BAWAAN, dariDatabase: false };
  }

  return {
    dariDatabase: true,
    kebijakan: {
      mingguPerSemester: baris.mingguPerSemester,
      pertemuanEfektifTeori: baris.pertemuanEfektifTeori,
      pertemuanEfektifPraktik: baris.pertemuanEfektifPraktik,
      hitungMingguUjian: baris.hitungMingguUjian,
      menitTmPerUjian: baris.menitTmPerUjian,
      jamPerSksPerSemester: Number(baris.jamPerSksPerSemester),
      toleransiSemesterPersen: Number(baris.toleransiSemesterPersen),
      toleransiPertemuanPersen: Number(baris.toleransiPertemuanPersen),
      bentuk: baris.bentuk.map((b) => ({
        bentuk: b.bentuk,
        tm: b.menitTmPerSks,
        pt: b.menitPtPerSks,
        bm: b.menitBmPerSks,
        tmTerjadwal: b.tmTerjadwal,
        butuhRuangKhusus: b.butuhRuangKhusus,
      })),
    },
  };
}
