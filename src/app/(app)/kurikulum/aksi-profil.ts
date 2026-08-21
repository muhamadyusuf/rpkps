"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import type { HasilSimpan } from "./aksi";

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
    .min(1, "Kode profil lulusan wajib diisi.")
    .max(20, "Kode profil lulusan terlalu panjang.")
    .transform((v) => v.toUpperCase()),
  deskripsi: z
    .string()
    .trim()
    .min(15, "Rumusan profil terlalu pendek untuk menggambarkan sebuah peran."),
});

type Sesi = Awaited<ReturnType<typeof wajibPeran>>;

type Wenang = { ok: true; sesi: Sesi } | { ok: false; pesan: string };

/**
 * Memastikan pengguna berwenang atas kurikulum, dan kurikulumnya masih boleh
 * disunting. Sesinya ikut dikembalikan supaya pencatatan audit tidak perlu
 * memverifikasi cookie untuk kedua kalinya.
 */
async function pastikanWenang(kurikulumId: string): Promise<Wenang> {
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id: kurikulumId },
    select: { prodiId: true, status: true },
  });
  if (!kurikulum) return { ok: false, pesan: "Kurikulum tidak ditemukan." };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: "Anda tidak berwenang atas program studi tersebut." };
  }
  if (kurikulum.status === "ARSIP") {
    return { ok: false, pesan: "Kurikulum yang diarsipkan tidak dapat disunting." };
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

function segarkan(kurikulumId: string) {
  revalidatePath(`/kurikulum/${kurikulumId}`);
}

export async function tambahProfilLulusan(
  kurikulumId: string,
  kode: string,
  deskripsi: string,
): Promise<HasilSimpan> {
  const wenang = await pastikanWenang(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaProfil.safeParse({ kode, deskripsi });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const bentrok = await prisma.profilLulusan.findFirst({
    where: { kurikulumId, kode: parsed.data.kode },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: `${parsed.data.kode} sudah ada pada kurikulum ini.` };
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
  segarkan(kurikulumId);
  return { ok: true, pesan: `${parsed.data.kode} ditambahkan.` };
}

export async function perbaruiProfilLulusan(
  id: string,
  kode: string,
  deskripsi: string,
): Promise<HasilSimpan> {
  const kurikulumId = await kurikulumProfil(id);
  if (!kurikulumId) return { ok: false, pesan: "Profil lulusan tidak ditemukan." };

  const wenang = await pastikanWenang(kurikulumId);
  if (!wenang.ok) return wenang;

  const parsed = SkemaProfil.safeParse({ kode, deskripsi });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const bentrok = await prisma.profilLulusan.findFirst({
    where: { kurikulumId, kode: parsed.data.kode, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return { ok: false, pesan: `${parsed.data.kode} sudah dipakai profil lain.` };
  }

  await prisma.profilLulusan.update({
    where: { id },
    data: { kode: parsed.data.kode, deskripsi: parsed.data.deskripsi },
  });

  await catat(wenang.sesi, kurikulumId, `menyunting profil lulusan ${parsed.data.kode}`);
  segarkan(kurikulumId);
  return { ok: true, pesan: `${parsed.data.kode} diperbarui.` };
}

export async function hapusProfilLulusan(id: string): Promise<HasilSimpan> {
  const profil = await prisma.profilLulusan.findUnique({
    where: { id },
    select: { kurikulumId: true, kode: true },
  });
  if (!profil) return { ok: false, pesan: "Profil lulusan tidak ditemukan." };

  const wenang = await pastikanWenang(profil.kurikulumId);
  if (!wenang.ok) return wenang;

  // Baris cpl_profil_lulusan ikut terhapus lewat onDelete: Cascade — CPL-nya
  // sendiri tidak tersentuh.
  await prisma.profilLulusan.delete({ where: { id } });

  await catat(wenang.sesi, profil.kurikulumId, `menghapus profil lulusan ${profil.kode}`);
  segarkan(profil.kurikulumId);
  return { ok: true, pesan: `${profil.kode} dihapus.` };
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
  const profil = await prisma.profilLulusan.findUnique({
    where: { id: profilLulusanId },
    select: { kurikulumId: true, kode: true },
  });
  if (!profil) return { ok: false, pesan: "Profil lulusan tidak ditemukan." };

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
  segarkan(profil.kurikulumId);
  return {
    ok: true,
    pesan:
      sah.length === 0
        ? `Seluruh CPL dilepas dari ${profil.kode}.`
        : `${sah.length} CPL ditetapkan menopang ${profil.kode}.`,
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
