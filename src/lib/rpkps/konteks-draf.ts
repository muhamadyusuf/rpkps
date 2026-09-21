import type { KonteksDraf } from "@/domain/rpkps/draf";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { refPustaka } from "@/lib/rpkps/tulis-draf";

/**
 * Keadaan RPKPS yang menjadi batas bagi sebuah draf — dipakai penerapan draf
 * AI dan impor template (docs/23), supaya keduanya diperiksa terhadap batas
 * yang persis sama.
 */

/**
 * Bidang yang dimuat sebagai batas bagi draf.
 *
 * Ditulis sebagai konstanta ber-`satisfies`, bukan literal di dalam pemanggilan,
 * supaya bentuk hasilnya dapat dinamai lewat RpkpsGetPayload. Ditulis inline,
 * inferensi Prisma menyerah pada select sedalam ini dan mengembalikan tipe
 * model penuh — yang membuat setiap relasi tampak tidak ada.
 */
export const PILIH_KONTEKS = {
  deskripsi: true,
  arahanAi: true,
  mataKuliah: {
    select: {
      kode: true, nama: true, deskripsi: true, semester: true,
      sksTeori: true, sksPraktik: true,
      cpl: { select: { cpl: { select: { kode: true, deskripsi: true } } } },
      cpmk: {
        orderBy: { urutan: "asc" },
        select: {
          kode: true, rumusan: true, levelBloom: true,
          subCpmk: {
            orderBy: { urutan: "asc" },
            select: { id: true, kode: true, rumusan: true, levelBloom: true },
          },
        },
      },
    },
  },
  pustaka: {
    orderBy: [{ jenis: "asc" }, { nomor: "asc" }],
    select: { nomor: true, jenis: true, teks: true },
  },
  komponenNilai: {
    orderBy: { urutan: "asc" },
    select: { id: true, nama: true, bobot: true },
  },
  pertemuan: {
    orderBy: { minggu: "asc" },
    select: {
      id: true, minggu: true, jenis: true,
      aktivitas: { select: { kategori: true, menit: true } },
      subCpmk: { select: { subCpmk: { select: { id: true, kode: true } } } },
    },
  },
} satisfies Prisma.RpkpsSelect;

export type Konteks = Prisma.RpkpsGetPayload<{ select: typeof PILIH_KONTEKS }>;

/**
 * Klien diterima sebagai parameter, bukan diimpor: berkas ini juga dipakai uji
 * integrasi terhadap Postgres sungguhan, yang tidak dapat memuat `@/lib/prisma`
 * (ia `server-only`).
 */
export function muatKonteks(
  db: Pick<PrismaClient, "rpkps">,
  rpkpsId: string,
): Promise<Konteks | null> {
  return db.rpkps.findUnique({ where: { id: rpkpsId }, select: PILIH_KONTEKS });
}

export function konteksDomain(k: Konteks): KonteksDraf {
  return {
    mingguEfektif: k.pertemuan.filter((p) => p.jenis === "EFEKTIF").map((p) => p.minggu),
    semuaMinggu: k.pertemuan.map((p) => p.minggu),
    mingguUjian: k.pertemuan
      .filter((p) => p.jenis !== "EFEKTIF")
      .map((p) => ({ minggu: p.minggu, jenis: p.jenis as "UTS" | "UAS" })),
    subCpmkTersedia: k.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)),
    // Sub-CPMK per minggu datang dari kerangka, bukan dari draf: inilah yang
    // menentukan apakah bobot sebuah minggu dapat mengalir ke capaian.
    subCpmkPerMinggu: Object.fromEntries(
      k.pertemuan.map((p) => [p.minggu, p.subCpmk.map((s) => s.subCpmk.kode)]),
    ),
    refPustaka: k.pustaka.map(refPustaka),
  };
}

