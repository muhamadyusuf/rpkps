"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { Peran, StatusPengguna } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { pesanZod } from "@/lib/bahasa/zod";

/** String kosong dari form dianggap "tidak diisi", bukan string kosong. */
const opsional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const SkemaProfil = z.object({
  nama: z.string().trim().min(2, "@aksi.periksa.namaMinimal"),
  gelarDepan: opsional,
  gelarBelakang: opsional,
  nidn: opsional.refine(
    (v) => v === null || /^\d{8,10}$/.test(v),
    "@aksi.periksa.nidnDigit",
  ),
  nip: opsional.refine(
    (v) => v === null || /^\d{8,18}$/.test(v),
    "@aksi.periksa.nipDigit",
  ),
  nik: opsional,
  telepon: opsional,
});

export type HasilAksi = { ok: boolean; pesan: string };

export async function perbaruiProfil(
  penggunaId: string,
  data: FormData,
): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaProfil.safeParse({
    nama: data.get("nama"),
    gelarDepan: data.get("gelarDepan"),
    gelarBelakang: data.get("gelarBelakang"),
    nidn: data.get("nidn"),
    nip: data.get("nip"),
    nik: data.get("nik"),
    telepon: data.get("telepon"),
  });

  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  try {
    await prisma.pengguna.update({
      where: { id: penggunaId },
      data: parsed.data,
    });
  } catch (galat) {
    // NIDN/NIP/NIK bersifat unik — tabrakan dilaporkan sebagai pesan yang berguna,
    // bukan galat internal.
    const pesan =
      galat instanceof Error && galat.message.includes("Unique constraint")
        ? kam.aksi.lain.pengenalTerpakai
        : kam.aksi.lain.gagalSimpanProfil;
    return { ok: false, pesan };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PROFIL_DIPERBARUI",
      entitas: "pengguna",
      entitasId: penggunaId,
      ringkasan: `${sesi.email} memperbarui profil pengguna`,
    },
  });

  segarkan(`/pengguna/${penggunaId}`);
  segarkan("/pengguna");
  return { ok: true, pesan: kam.aksi.kurikulum.profilTersimpan };
}

export async function ubahStatus(
  penggunaId: string,
  status: StatusPengguna,
): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  if (penggunaId === sesi.id && status !== "AKTIF") {
    return { ok: false, pesan: kam.aksi.wenang.nonaktifSendiri };
  }

  await prisma.pengguna.update({ where: { id: penggunaId }, data: { status } });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "STATUS_DIUBAH",
      entitas: "pengguna",
      entitasId: penggunaId,
      ringkasan: `${sesi.email} mengubah status pengguna menjadi ${status}`,
    },
  });

  segarkan(`/pengguna/${penggunaId}`);
  segarkan("/pengguna");
  return { ok: true, pesan: kam.aksi.umum.statusDiperbarui };
}

/** Peran bercakupan institusi (tanpa prodi). */
const PERAN_INSTITUSI: Peran[] = ["ADMIN", "GPM", "ASESOR"];

export async function tambahPeran(
  penggunaId: string,
  peran: Peran,
  prodiId: string | null,
): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const butuhProdi = !PERAN_INSTITUSI.includes(peran);
  if (butuhProdi && !prodiId) {
    return { ok: false, pesan: kam.aksi.pengguna.peranButuhProdi };
  }
  const prodiFinal = butuhProdi ? prodiId : null;

  const sudahAda = await prisma.penugasanPeran.findFirst({
    where: { penggunaId, peran, prodiId: prodiFinal },
    select: { id: true },
  });
  if (sudahAda) return { ok: false, pesan: kam.aksi.koordinator.sudahAda };

  await prisma.penugasanPeran.create({
    data: { penggunaId, peran, prodiId: prodiFinal },
  });

  // Memberi peran berarti pengguna sudah diverifikasi.
  await prisma.pengguna.updateMany({
    where: { id: penggunaId, status: "MENUNGGU_VERIFIKASI" },
    data: { status: "AKTIF" },
  });

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PERAN_DITAMBAHKAN",
      entitas: "pengguna",
      entitasId: penggunaId,
      ringkasan: `${sesi.email} menambahkan peran ${peran}`,
    },
  });

  segarkan(`/pengguna/${penggunaId}`);
  segarkan("/pengguna");
  return { ok: true, pesan: kam.aksi.pengguna.peranDitambahkan };
}

export async function hapusPeran(penugasanId: string): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const penugasan = await prisma.penugasanPeran.findUnique({
    where: { id: penugasanId },
    select: { id: true, penggunaId: true, peran: true },
  });
  if (!penugasan) return { ok: false, pesan: kam.aksi.takAda.penugasan };

  // Jangan sampai sistem kehilangan administrator terakhirnya.
  if (penugasan.peran === "ADMIN") {
    const jumlahAdmin = await prisma.penugasanPeran.count({ where: { peran: "ADMIN" } });
    if (jumlahAdmin <= 1) {
      return { ok: false, pesan: kam.aksi.wenang.adminTerakhir };
    }
  }

  await prisma.penugasanPeran.delete({ where: { id: penugasanId } });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PERAN_DIHAPUS",
      entitas: "pengguna",
      entitasId: penugasan.penggunaId,
      ringkasan: `${sesi.email} menghapus peran ${penugasan.peran}`,
    },
  });

  segarkan(`/pengguna/${penugasan.penggunaId}`);
  segarkan("/pengguna");
  return { ok: true, pesan: kam.aksi.pengguna.peranDihapus };
}
