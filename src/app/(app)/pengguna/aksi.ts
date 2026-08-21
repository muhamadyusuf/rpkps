"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { Peran, StatusPengguna } from "@/generated/prisma";

/** String kosong dari form dianggap "tidak diisi", bukan string kosong. */
const opsional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const SkemaProfil = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter."),
  gelarDepan: opsional,
  gelarBelakang: opsional,
  nidn: opsional.refine(
    (v) => v === null || /^\d{8,10}$/.test(v),
    "NIDN harus 8–10 digit angka.",
  ),
  nip: opsional.refine(
    (v) => v === null || /^\d{8,18}$/.test(v),
    "NIP harus 8–18 digit angka.",
  ),
  nik: opsional,
  telepon: opsional,
});

export type HasilAksi = { ok: boolean; pesan: string };

export async function perbaruiProfil(
  penggunaId: string,
  data: FormData,
): Promise<HasilAksi> {
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
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
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
        ? "NIDN, NIP, atau NIK tersebut sudah dipakai pengguna lain."
        : "Gagal menyimpan profil.";
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

  revalidatePath(`/pengguna/${penggunaId}`);
  revalidatePath("/pengguna");
  return { ok: true, pesan: "Profil tersimpan." };
}

export async function ubahStatus(
  penggunaId: string,
  status: StatusPengguna,
): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  if (penggunaId === sesi.id && status !== "AKTIF") {
    return { ok: false, pesan: "Anda tidak dapat menonaktifkan akun sendiri." };
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

  revalidatePath(`/pengguna/${penggunaId}`);
  revalidatePath("/pengguna");
  return { ok: true, pesan: "Status diperbarui." };
}

/** Peran bercakupan institusi (tanpa prodi). */
const PERAN_INSTITUSI: Peran[] = ["ADMIN", "GPM", "ASESOR"];

export async function tambahPeran(
  penggunaId: string,
  peran: Peran,
  prodiId: string | null,
): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  const butuhProdi = !PERAN_INSTITUSI.includes(peran);
  if (butuhProdi && !prodiId) {
    return { ok: false, pesan: "Peran ini harus terikat pada satu program studi." };
  }
  const prodiFinal = butuhProdi ? prodiId : null;

  const sudahAda = await prisma.penugasanPeran.findFirst({
    where: { penggunaId, peran, prodiId: prodiFinal },
    select: { id: true },
  });
  if (sudahAda) return { ok: false, pesan: "Penugasan tersebut sudah ada." };

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

  revalidatePath(`/pengguna/${penggunaId}`);
  revalidatePath("/pengguna");
  return { ok: true, pesan: "Peran ditambahkan." };
}

export async function hapusPeran(penugasanId: string): Promise<HasilAksi> {
  const sesi = await wajibPeran("ADMIN");

  const penugasan = await prisma.penugasanPeran.findUnique({
    where: { id: penugasanId },
    select: { id: true, penggunaId: true, peran: true },
  });
  if (!penugasan) return { ok: false, pesan: "Penugasan tidak ditemukan." };

  // Jangan sampai sistem kehilangan administrator terakhirnya.
  if (penugasan.peran === "ADMIN") {
    const jumlahAdmin = await prisma.penugasanPeran.count({ where: { peran: "ADMIN" } });
    if (jumlahAdmin <= 1) {
      return { ok: false, pesan: "Tidak boleh menghapus administrator terakhir." };
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

  revalidatePath(`/pengguna/${penugasan.penggunaId}`);
  revalidatePath("/pengguna");
  return { ok: true, pesan: "Peran dihapus." };
}
