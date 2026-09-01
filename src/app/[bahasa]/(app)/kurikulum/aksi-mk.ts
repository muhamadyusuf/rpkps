"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import type { BentukPembelajaran, StatusMataKuliah } from "@/generated/prisma";
import {
  normalkanKode,
  periksaKelayakanHapusMk,
  periksaKelayakanUbahMk,
} from "@/domain/kurikulum/sunting";
import {
  catatSunting,
  pastikanWenangSunting,
  pesanKelayakan,
  segarkanKurikulum,
  sensusMataKuliah,
  setelMatriksCplMk,
} from "@/lib/kurikulum/sunting";
import type { HasilSimpan } from "./aksi";

/**
 * CRUD mata kuliah langsung dari halaman kurikulum. Acuan: docs/15 §4.
 *
 * `MataKuliah` adalah baris paling berbahaya di lapisan ini: cascade-nya
 * menjangkau `rpkps → rpkps_snapshot`, `kelas → peserta_kelas → nilai`, dan
 * `evaluasi_mk`. Karena itu penghapusannya melewati `periksaKelayakanHapusMk`
 * yang menolak tanpa ambang — satu RPKPS saja sudah cukup.
 */

const BENTUK: readonly BentukPembelajaran[] = [
  "KULIAH",
  "RESPONSI",
  "TUTORIAL",
  "SEMINAR",
  "PRAKTIKUM",
  "PRAKTIK_STUDIO",
  "PRAKTIK_BENGKEL",
  "PRAKTIK_LAPANGAN",
  "PENELITIAN",
  "PKM",
  "KKN",
];

const STATUS: readonly StatusMataKuliah[] = ["WAJIB", "PILIHAN", "WAJIB_UMUM"];

const SkemaMk = z
  .object({
    kode: z
      .string()
      .trim()
      .min(2, "@aksi.periksa.kodeMkWajib")
      .max(20, "@aksi.periksa.kodeMkPanjang")
      .transform(normalkanKode),
    nama: z.string().trim().min(3, "@aksi.periksa.namaMkPendek"),
    /**
     * Nama dan deskripsi berbahasa Inggris. Selalu opsional — terjemahan
     * bukan syarat apa pun (docs/11 §5.6) — tetapi SELALU ikut dalam muatan
     * simpan: `update` di bawah menulis seluruh `parsed.data`, jadi medan yang
     * tidak dikirim borang akan terhapus tanpa satu pesan pun (docs/11 §5.3).
     */
    namaEn: z.string().trim().max(200).nullable(),
    deskripsi: z.string().trim().max(4000).nullable(),
    deskripsiEn: z.string().trim().max(4000).nullable(),
    semester: z.number().int().min(1).max(14),
    status: z.enum(STATUS as [StatusMataKuliah, ...StatusMataKuliah[]]),
    sksTeori: z.number().int().min(0).max(12),
    sksPraktik: z.number().int().min(0).max(12),
    bentukTeori: z.enum(BENTUK as [BentukPembelajaran, ...BentukPembelajaran[]]),
    bentukPraktik: z.enum(BENTUK as [BentukPembelajaran, ...BentukPembelajaran[]]),
  })
  .refine((v) => v.sksTeori + v.sksPraktik > 0, {
    message: "@aksi.periksa.sksNol",
    path: ["sksTeori"],
  });

export type MasukanMk = z.input<typeof SkemaMk>;

async function kurikulumMk(id: string): Promise<string | null> {
  const mk = await prisma.mataKuliah.findUnique({
    where: { id },
    select: { kurikulumId: true },
  });
  return mk?.kurikulumId ?? null;
}

export async function tambahMataKuliah(
  kurikulumId: string,
  masukan: MasukanMk,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const wenang = await pastikanWenangSunting(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaMk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.mataKuliah.findFirst({
    where: { kurikulumId, kode: parsed.data.kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAda, { kode: parsed.data.kode }) };
  }

  await prisma.mataKuliah.create({ data: { kurikulumId, ...parsed.data } });

  await catatSunting(wenang.sesi, kurikulumId, `menambah mata kuliah ${parsed.data.kode}`);
  segarkanKurikulum(kurikulumId);
  return {
    ok: true,
    pesan: sisip(kam.aksi.kurikulum.kodeDitambahkan, { kode: parsed.data.kode }),
  };
}

export async function perbaruiMataKuliah(
  id: string,
  masukan: MasukanMk,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const kurikulumId = await kurikulumMk(id);
  if (!kurikulumId) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };

  const wenang = await pastikanWenangSunting(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaMk.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  // Kode, nama, semester, dan sks seluruhnya ikut `proyeksiIsi()`. Yang
  // menghalangi bukan keberadaan RPKPS, melainkan RPKPS yang sudah punya
  // SALINAN BEKU — draf belum menandatangani apa pun (docs/15 §2.3).
  //
  // `namaEn` dan `deskripsiEn` ikut terkunci di gerbang yang sama meski tidak
  // menyentuh `proyeksiIsi()`: keduanya masuk ruang sidik kedua lewat
  // `proyeksiIsiEn()`, dan menggeser sidik Inggris sebuah dokumen terbit sama
  // saja artinya dengan menggeser sidik Indonesianya (docs/11 §6.2).
  const sensus = await sensusMataKuliah(id);
  if (!sensus) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };
  const kelayakan = periksaKelayakanUbahMk(sensus);
  if (!kelayakan.boleh) return { ok: false, pesan: pesanKelayakan(kelayakan) };

  const bentrok = await prisma.mataKuliah.findFirst({
    where: { kurikulumId, kode: parsed.data.kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.kurikulum.kodeDipakaiMkLain, { kode: parsed.data.kode }),
    };
  }

  await prisma.mataKuliah.update({ where: { id }, data: parsed.data });

  await catatSunting(wenang.sesi, kurikulumId, `menyunting mata kuliah ${parsed.data.kode}`);
  segarkanKurikulum(kurikulumId, id);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDiperbarui, { kode: parsed.data.kode }) };
}

export async function hapusMataKuliah(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const mk = await prisma.mataKuliah.findUnique({
    where: { id },
    select: { kurikulumId: true, kode: true },
  });
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };

  const wenang = await pastikanWenangSunting(mk.kurikulumId);
  if (!wenang.ok) return wenang;

  const sensus = await sensusMataKuliah(id);
  if (!sensus) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };
  const kelayakan = periksaKelayakanHapusMk(sensus);
  if (!kelayakan.boleh) return { ok: false, pesan: pesanKelayakan(kelayakan) };

  // CPMK dan Sub-CPMK di bawahnya ikut lewat cascade. Itu memang yang
  // dimaksud: gerbang di atas sudah memastikan tak satu pun dirujuk dokumen.
  await prisma.mataKuliah.delete({ where: { id } });

  await catatSunting(wenang.sesi, mk.kurikulumId, `menghapus mata kuliah ${mk.kode}`);
  segarkanKurikulum(mk.kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDihapus, { kode: mk.kode }) };
}

/**
 * Menyetel CPL yang dibebankan pada sebuah mata kuliah — matriks CPL×MK.
 *
 * Mengganti SELURUH himpunan, bukan menambah satu per satu: penyimpanan
 * berulang jadi idempoten dan pelepasan pemetaan tidak butuh aksi tersendiri.
 * Pola yang sama dipakai `setelCplProfilLulusan`.
 */
export async function setelCplMataKuliah(
  mataKuliahId: string,
  cplId: string[],
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const mk = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: { kurikulumId: true, kode: true },
  });
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };

  const wenang = await pastikanWenangSunting(mk.kurikulumId);
  if (!wenang.ok) return wenang;

  // Hanya CPL milik kurikulum yang sama. Tanpa penyaringan ini, id CPL dari
  // kurikulum — bahkan prodi — lain bisa ditempelkan lewat permintaan buatan.
  const sah = await prisma.cpl.findMany({
    where: { id: { in: [...new Set(cplId)] }, kurikulumId: mk.kurikulumId },
    select: { id: true },
  });

  // Menyetel matriks sekaligus merapikan peta CPMK×CPL yang ikut basi; kedua
  // langkahnya satu transaksi di `sunting-inti.ts`.
  await setelMatriksCplMk(
    mataKuliahId,
    sah.map((c) => c.id),
  );

  await catatSunting(
    wenang.sesi,
    mk.kurikulumId,
    `menyetel ${sah.length} CPL pada mata kuliah ${mk.kode}`,
  );
  segarkanKurikulum(mk.kurikulumId, mataKuliahId);
  return {
    ok: true,
    pesan: sisip(kam.aksi.kurikulum.pemetaanDisetel, { jumlah: sah.length, kode: mk.kode }),
  };
}
