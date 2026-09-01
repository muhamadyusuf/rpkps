"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import type { HasilSimpan } from "./aksi";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";

/**
 * Pengelolaan profil lulusan langsung dari halaman kurikulum.
 *
 * Berdampingan dengan jalur impor Excel, bukan menggantikannya. Kurikulum yang
 * sudah berstatus BERLAKU dan menggantung RPKPS terbit tidak bisa dihapus untuk
 * diimpor ulang, padahal profil lulusannya perlu dilengkapi — di situlah aksi
 * di berkas ini dipakai.
 *
 * **Aman dilakukan pada kurikulum BERLAKU.** Profil lulusan tidak ikut dalam
 * `proyeksiIsi()`, sehingga menyuntingnya tidak mengubah sidik SHA-256 satu pun
 * RPKPS yang sudah disahkan. Bila suatu saat profil lulusan ditambahkan ke
 * proyeksi itu, batasan di sini harus diperketat lebih dulu.
 */

const SkemaProfil = z.object({
  kode: z
    .string()
    .trim()
    .min(1, "@aksi.periksa.kodeProfilWajib")
    .max(20, "@aksi.periksa.kodeProfilPanjang")
    .transform((v) => v.toUpperCase()),
  deskripsi: z
    .string()
    .trim()
    .min(15, "@aksi.periksa.rumusanProfilPendek"),
});

type Sesi = Awaited<ReturnType<typeof wajibPeran>>;

type Wenang = { ok: true; sesi: Sesi } | { ok: false; pesan: string };

/**
 * Memastikan pengguna berwenang atas kurikulum, dan kurikulumnya masih boleh
 * disunting. Sesinya ikut dikembalikan supaya pencatatan audit tidak perlu
 * memverifikasi cookie untuk kedua kalinya.
 */
async function pastikanWenang(kurikulumId: string): Promise<Wenang> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id: kurikulumId },
    select: { prodiId: true, status: true },
  });
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }
  if (kurikulum.status === "ARSIP") {
    return { ok: false, pesan: kam.aksi.kurikulum.arsipTakDisunting };
  }

  return { ok: true, sesi };
}

/** Kurikulum induk sebuah profil — profil sendiri tidak menyimpan prodiId. */
async function kurikulumProfil(id: string): Promise<string | null> {
  const profil = await prisma.profilLulusan.findUnique({
    where: { id },
    select: { kurikulumId: true },
  });
  return profil?.kurikulumId ?? null;
}

function segarkanKurikulum(kurikulumId: string) {
  segarkan(`/kurikulum/${kurikulumId}`);
}

export async function tambahProfilLulusan(
  kurikulumId: string,
  kode: string,
  deskripsi: string,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const wenang = await pastikanWenang(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaProfil.safeParse({ kode, deskripsi });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.profilLulusan.findFirst({
    where: { kurikulumId, kode: parsed.data.kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeSudahAda, { kode: parsed.data.kode }) };
  }

  // Urutan menyusul yang terakhir, bukan dihitung dari jumlah baris: menghapus
  // satu profil di tengah membuat jumlah dan urutan tertinggi tidak lagi sama.
  const terakhir = await prisma.profilLulusan.findFirst({
    where: { kurikulumId },
    orderBy: { urutan: "desc" },
    select: { urutan: true },
  });

  await prisma.profilLulusan.create({
    data: {
      kurikulumId,
      kode: parsed.data.kode,
      deskripsi: parsed.data.deskripsi,
      urutan: (terakhir?.urutan ?? -1) + 1,
    },
  });

  await catat(wenang.sesi, kurikulumId, `menambah profil lulusan ${parsed.data.kode}`);
  segarkanKurikulum(kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDitambahkan, { kode: parsed.data.kode }) };
}

export async function perbaruiProfilLulusan(
  id: string,
  kode: string,
  deskripsi: string,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const kurikulumId = await kurikulumProfil(id);
  if (!kurikulumId) return { ok: false, pesan: kam.aksi.takAda.profilLulusan };

  const wenang = await pastikanWenang(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaProfil.safeParse({ kode, deskripsi });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const bentrok = await prisma.profilLulusan.findFirst({
    where: { kurikulumId, kode: parsed.data.kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: sisip(kam.aksi.kurikulum.kodeDipakaiLain, { kode: parsed.data.kode }) };
  }

  await prisma.profilLulusan.update({
    where: { id },
    data: { kode: parsed.data.kode, deskripsi: parsed.data.deskripsi },
  });

  await catat(wenang.sesi, kurikulumId, `menyunting profil lulusan ${parsed.data.kode}`);
  segarkanKurikulum(kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.kodeDiperbarui, { kode: parsed.data.kode }) };
}

export async function hapusProfilLulusan(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const profil = await prisma.profilLulusan.findUnique({
    where: { id },
    select: { kurikulumId: true, kode: true },
  });
  if (!profil) return { ok: false, pesan: kam.aksi.takAda.profilLulusan };

  const wenang = await pastikanWenang(profil.kurikulumId);
  if (!wenang.ok) return wenang;

  // Baris cpl_profil_lulusan ikut terhapus lewat onDelete: Cascade — CPL-nya
  // sendiri tidak tersentuh.
  await prisma.profilLulusan.delete({ where: { id } });

  await catat(wenang.sesi, profil.kurikulumId, `menghapus profil lulusan ${profil.kode}`);
  segarkanKurikulum(profil.kurikulumId);
  return { ok: true, pesan: sisip(kam.aksi.kurikulum.profilDihapus, { kode: profil.kode }) };
}

/**
 * Menyetel CPL penopang sebuah profil.
 *
 * Mengganti SELURUH himpunan, bukan menambah satu per satu: penyimpanan
 * berulang jadi idempoten, dan pelepasan pemetaan tidak butuh aksi tersendiri.
 * Pola yang sama dipakai usulan AI PETA_CPL di src/lib/ai/perbaikan-kurikulum.ts.
 */
export async function setelCplProfilLulusan(
  profilLulusanId: string,
  cplId: string[],
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const profil = await prisma.profilLulusan.findUnique({
    where: { id: profilLulusanId },
    select: { kurikulumId: true, kode: true },
  });
  if (!profil) return { ok: false, pesan: kam.aksi.takAda.profilLulusan };

  const wenang = await pastikanWenang(profil.kurikulumId);
  if (!wenang.ok) return wenang;

  // Hanya CPL milik kurikulum yang sama. Tanpa penyaringan ini, id CPL dari
  // kurikulum — bahkan prodi — lain bisa ditempelkan lewat permintaan buatan.
  const sah = await prisma.cpl.findMany({
    where: { id: { in: [...new Set(cplId)] }, kurikulumId: profil.kurikulumId },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.cplProfilLulusan.deleteMany({ where: { profilLulusanId } }),
    prisma.cplProfilLulusan.createMany({
      data: sah.map((c) => ({ profilLulusanId, cplId: c.id })),
    }),
  ]);

  await catat(
    wenang.sesi,
    profil.kurikulumId,
    `menyetel ${sah.length} CPL penopang profil ${profil.kode}`,
  );
  segarkanKurikulum(profil.kurikulumId);
  return {
    ok: true,
    pesan:
      sah.length === 0
        ? sisip(kam.aksi.lain.cplDilepas, { kode: profil.kode })
        : sisip(kam.aksi.lain.cplDitetapkan, { n: sah.length, kode: profil.kode }),
  };
}

async function catat(sesi: Sesi, kurikulumId: string, ringkasan: string) {
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PROFIL_LULUSAN_DIUBAH",
      entitas: "kurikulum",
      entitasId: kurikulumId,
      ringkasan: `${sesi.email} ${ringkasan}`,
    },
  });
}
