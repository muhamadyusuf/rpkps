import type { BarisKerangka } from "@/domain/rpkps/kerangka";
import type { Prisma } from "@/generated/prisma";

/**
 * Menulis kerangka mingguan hasil `rancangKerangkaMingguan` ke basis data.
 *
 * Berada di sini, bukan di berkas `"use server"`, karena ia menerima klien
 * transaksi Prisma — argumen yang tidak dapat diserialkan dan karena itu tidak
 * boleh menjadi server action. Dipakai `buatRpkps` dan `susunUlangKerangkaDb`
 * supaya keduanya tidak bisa menghasilkan kerangka yang berbeda.
 *
 * Tanpa penanda `server-only`, dengan alasan yang sama seperti
 * `lib/rpkps/struktur.ts`: penanda itu melempar galat di `uji/integrasi.ts`.
 */
export async function tulisKerangka(
  tx: Prisma.TransactionClient,
  rpkpsId: string,
  baris: readonly BarisKerangka[],
) {
  for (const b of baris) {
    await tx.pertemuan.create({
      data: {
        rpkpsId,
        minggu: b.minggu,
        jenis: b.jenis,
        topik: b.topik,
        subtopik: [],
        bobot: 0,
        aktivitas: { create: b.aktivitas },
        ...(b.subCpmkId ? { subCpmk: { create: { subCpmkId: b.subCpmkId } } } : {}),
      },
    });
  }
}
