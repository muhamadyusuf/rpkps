import { capIsiRpkps, type SumberCap } from "@/domain/rpkps/cap-isi";
import type { Prisma } from "@/generated/prisma";
import type { Konteks } from "@/lib/rpkps/konteks-draf";

/**
 * Pembacaan keadaan isi RPKPS untuk impor template (docs/23): penanda versi
 * dan ringkasan yang akan tertimpa.
 *
 * Klien diterima sebagai parameter dan berkas ini tidak `server-only`: penanda
 * versi hanya terbukti terhadap Postgres sungguhan (uji integrasi), dan
 * `@/lib/prisma` tidak dapat dimuat di sana.
 */

type Klien = Pick<Prisma.TransactionClient, "rpkps" | "pertemuan" | "tugas" | "kisiKisi">;

/** Membaca himpunan baris yang dicap dan menghitung capnya. */
export async function bacaCapIsi(db: Klien, rpkpsId: string): Promise<string | null> {
  const r = await db.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      diubahPada: true,
      pertemuan: { select: { id: true, diubahPada: true } },
      tugas: { select: { id: true, diubahPada: true } },
      kisiKisi: { select: { id: true, diubahPada: true } },
      komponenNilai: { select: { nama: true, bobot: true } },
      _count: { select: { pustaka: true } },
    },
  });
  if (!r) return null;
  const sumber: SumberCap = {
    rpkpsDiubah: r.diubahPada,
    pertemuan: r.pertemuan,
    tugas: r.tugas,
    kisiKisi: r.kisiKisi,
    komponen: r.komponenNilai.map((c) => ({ nama: c.nama, bobot: Number(c.bobot) })),
    jumlahPustaka: r._count.pustaka,
  };
  return capIsiRpkps(sumber);
}

export interface RingkasTimpa {
  mingguTerisi: number;
  mingguEfektif: number;
  tugas: number;
  kisiKisi: number;
}

/** Seberapa banyak isi dokumen yang akan diganti — untuk pratinjau (§3.3). */
export async function hitungTimpa(db: Klien, rpkpsId: string, k: Konteks): Promise<RingkasTimpa> {
  const [mingguTerisi, tugas, kisiKisi] = await Promise.all([
    db.pertemuan.count({
      where: { rpkpsId, jenis: "EFEKTIF", topik: { not: null }, NOT: { topik: "" } },
    }),
    db.tugas.count({ where: { rpkpsId } }),
    db.kisiKisi.count({ where: { rpkpsId } }),
  ]);
  return {
    mingguTerisi,
    mingguEfektif: k.pertemuan.filter((p) => p.jenis === "EFEKTIF").length,
    tugas,
    kisiKisi,
  };
}

