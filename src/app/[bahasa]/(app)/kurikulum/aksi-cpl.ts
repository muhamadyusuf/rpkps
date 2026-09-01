"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import type { RanahCpl } from "@/generated/prisma";
import {
  geserUrutan,
  normalkanKode,
  periksaKelayakanHapusCpl,
} from "@/domain/kurikulum/sunting";
import {
  catatSunting,
  pastikanWenangSunting,
  pesanKelayakan,
  segarkanKurikulum,
  sensusCpl,
  urutanBerikutnya,
} from "@/lib/kurikulum/sunting";
import type { HasilSimpan } from "./aksi";

/**
 * CRUD Capaian Pembelajaran Lulusan langsung dari halaman kurikulum.
 * Acuan: docs/15 §4.
 *
 * Hanya pada kurikulum berstatus DRAF — gerbangnya ada di
 * `pastikanWenangSunting`, dan alasannya di `src/domain/kurikulum/sunting.ts`:
 * kode dan deskripsi CPL ikut `proyeksiIsi()` lewat matriks CPL×MK, sehingga
 * menyuntingnya pada kurikulum hidup menggeser sidik SHA-256 dokumen yang sudah
 * ditandatangani.
 */

const RANAH: readonly RanahCpl[] = [
  "SIKAP",
  "PENGETAHUAN",
  "KETERAMPILAN_UMUM",
  "KETERAMPILAN_KHUSUS",
];

const SkemaCpl = z.object({
  kode: z
    .string()
    .trim()
    .min(1, "@aksi.periksa.kodeCplWajib")
    .max(20, "@aksi.periksa.kodeCplPanjang")
    .transform(normalkanKode),
  deskripsi: z
    .string()
    .trim()
    .min(15, "@aksi.periksa.rumusanCplPendek"),
  ranah: z.enum(RANAH as [RanahCpl, ...RanahCpl[]]),
  // KKNI 6 sarjana, 7 profesi, 8 magister, 9 doktor. Boleh kosong: banyak buku
  // kurikulum tidak mencantumkannya per CPL.
  tingkatKkni: z.number().int().min(1).max(9).nullable(),
});

export type MasukanCpl = z.input<typeof SkemaCpl>;

/** Kurikulum induk sebuah CPL — CPL sendiri tidak menyimpan prodiId. */
async function kurikulumCpl(id: string): Promise<string | null> {
  const cpl = await prisma.cpl.findUnique({
    where: { id },
    select: { kurikulumId: true },
  });
  return cpl?.kurikulumId ?? null;
}

export async function tambahCpl(
  kurikulumId: string,
  masukan: MasukanCpl,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const wenang = await pastikanWenangSunting(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaCpl.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }
  const { kode, deskripsi, ranah, tingkatKkni } = parsed.data;

  const bentrok = await prisma.cpl.findFirst({
    where: { kurikulumId, kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAda, { kode }) };
  }

  const terakhir = await prisma.cpl.findFirst({
    where: { kurikulumId },
    orderBy: { urutan: "desc" },
    select: { urutan: true },
  });

  await prisma.cpl.create({
    data: {
      kurikulumId,
      kode,
      deskripsi,
      ranah,
      tingkatKkni,
      urutan: urutanBerikutnya(terakhir),
    },
  });

  await catatSunting(wenang.sesi, kurikulumId, `menambah ${kode}`);
  segarkanKurikulum(kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDitambahkan, { kode }) };
}

export async function perbaruiCpl(id: string, masukan: MasukanCpl): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const kurikulumId = await kurikulumCpl(id);
  if (!kurikulumId) return { ok: false, pesan: kam.aksi.takAda.cpl };

  const wenang = await pastikanWenangSunting(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaCpl.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }
  const { kode, deskripsi, ranah, tingkatKkni } = parsed.data;

  const bentrok = await prisma.cpl.findFirst({
    where: { kurikulumId, kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeDipakaiCplLain, { kode }) };
  }

  await prisma.cpl.update({
    where: { id },
    data: { kode, deskripsi, ranah, tingkatKkni },
  });

  await catatSunting(wenang.sesi, kurikulumId, `menyunting ${kode}`);
  segarkanKurikulum(kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDiperbarui, { kode }) };
}

export async function hapusCpl(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const cpl = await prisma.cpl.findUnique({
    where: { id },
    select: { kurikulumId: true, kode: true },
  });
  if (!cpl) return { ok: false, pesan: kam.aksi.takAda.cpl };

  const wenang = await pastikanWenangSunting(cpl.kurikulumId);
  if (!wenang.ok) return wenang;

  // G2. Dihitung dari basis data, bukan disimpulkan dari status kurikulum —
  // kurikulum ARSIP dapat dikembalikan ke DRAF sekalipun RPKPS terbit masih
  // menggantung padanya (docs/15 §2.2).
  const sensus = await sensusCpl(id);
  if (!sensus) return { ok: false, pesan: kam.aksi.takAda.cpl };
  const kelayakan = periksaKelayakanHapusCpl(sensus);
  if (!kelayakan.boleh) return { ok: false, pesan: pesanKelayakan(kelayakan) };

  // Baris cpl_profil_lulusan dan matriks_cpl_mk ikut terhapus lewat cascade;
  // profil lulusan dan mata kuliahnya sendiri tidak tersentuh.
  await prisma.cpl.delete({ where: { id } });

  await catatSunting(wenang.sesi, cpl.kurikulumId, `menghapus ${cpl.kode}`);
  segarkanKurikulum(cpl.kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDihapus, { kode: cpl.kode }) };
}

/**
 * Menggeser satu CPL naik atau turun.
 *
 * Seluruh daftar ditulis ulang dalam satu transaksi, bukan dua baris ditukar:
 * `urutan` hasil impor dan penghapusan berulang tidak dijamin rapat, dan
 * menukar dua nilai yang kebetulan sama tidak mengubah apa pun.
 */
export async function geserCpl(id: string, arah: "naik" | "turun"): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const kurikulumId = await kurikulumCpl(id);
  if (!kurikulumId) return { ok: false, pesan: kam.aksi.takAda.cpl };

  const wenang = await pastikanWenangSunting(kurikulumId);
  if (!wenang.ok) return wenang;

  const daftar = await prisma.cpl.findMany({
    where: { kurikulumId },
    select: { id: true, urutan: true },
  });

  const baru = geserUrutan(daftar, id, arah);
  // null berarti sudah di ujung daftar — bukan galat, tombolnya memang mati.
  if (!baru) return { ok: true, pesan: kam.aksi.umum.tersimpan };

  await prisma.$transaction(
    baru.map((x) => prisma.cpl.update({ where: { id: x.id }, data: { urutan: x.urutan } })),
  );

  segarkanKurikulum(kurikulumId);
  return { ok: true, pesan: kam.aksi.umum.tersimpan };
}
