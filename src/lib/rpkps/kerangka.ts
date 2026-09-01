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
  if (baris.length === 0) return;

  /**
   * Dulu satu `create` bersarang per baris, berarti 16 pulang-pergi jaringan
   * berurutan di dalam satu transaksi — pada basis data jarak jauh (Vercel +
   * Neon/Supabase) ini gampang melampaui batas waktu transaksi interaktif
   * Prisma (5 detik bawaan). `createMany` menekannya jadi tiga kueri saja,
   * berapa pun jumlah barisnya.
   */
  await tx.pertemuan.createMany({
    data: baris.map((b) => ({
      rpkpsId,
      minggu: b.minggu,
      jenis: b.jenis,
      topik: b.topik,
      subtopik: [],
      bobot: 0,
    })),
  });

  const dibuat = await tx.pertemuan.findMany({
    where: { rpkpsId, minggu: { in: baris.map((b) => b.minggu) } },
    select: { id: true, minggu: true },
  });
  const idPerMinggu = new Map(dibuat.map((p) => [p.minggu, p.id]));

  const aktivitas = baris.flatMap((b) => {
    const pertemuanId = idPerMinggu.get(b.minggu);
    if (!pertemuanId) return [];
    return b.aktivitas.map((a) => ({ ...a, pertemuanId }));
  });
  if (aktivitas.length > 0) {
    await tx.aktivitasBelajar.createMany({ data: aktivitas });
  }

  const subCpmk = baris.flatMap((b) => {
    const pertemuanId = idPerMinggu.get(b.minggu);
    if (!b.subCpmkId || !pertemuanId) return [];
    return [{ pertemuanId, subCpmkId: b.subCpmkId }];
  });
  if (subCpmk.length > 0) {
    await tx.pertemuanSubCpmk.createMany({ data: subCpmk });
  }
}
