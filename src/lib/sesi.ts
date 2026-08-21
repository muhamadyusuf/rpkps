import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { verifikasiCookieSesi } from "@/lib/firebase/admin";
import type { Peran, StatusPengguna } from "@/generated/prisma";

export const NAMA_COOKIE_SESI = "sesi";

export interface PeranTerpasang {
  peran: Peran;
  prodiId: string | null;
  prodiNama: string | null;
  prodiKode: string | null;
}

export interface PenggunaSesi {
  id: string;
  firebaseUid: string;
  email: string;
  nama: string;
  namaLengkap: string;
  nidn: string | null;
  nip: string | null;
  fotoUrl: string | null;
  status: StatusPengguna;
  penugasan: PeranTerpasang[];
  daftarPeran: Peran[];
}

/**
 * `cache` dari React membuat satu permintaan HTTP hanya sekali memverifikasi
 * cookie dan sekali menyentuh database, meski dipanggil dari banyak komponen.
 */
export const sesiSaatIni = cache(async (): Promise<PenggunaSesi | null> => {
  const cookie = (await cookies()).get(NAMA_COOKIE_SESI)?.value;
  if (!cookie) return null;

  const token = await verifikasiCookieSesi(cookie);
  if (!token) return null;

  const pengguna = await prisma.pengguna.findUnique({
    where: { firebaseUid: token.uid },
    include: {
      penugasan: {
        include: { prodi: { select: { id: true, nama: true, kode: true } } },
      },
    },
  });

  if (!pengguna || pengguna.status === "NONAKTIF") return null;

  const penugasan: PeranTerpasang[] = pengguna.penugasan.map((p) => ({
    peran: p.peran,
    prodiId: p.prodiId,
    prodiNama: p.prodi?.nama ?? null,
    prodiKode: p.prodi?.kode ?? null,
  }));

  return {
    id: pengguna.id,
    firebaseUid: pengguna.firebaseUid,
    email: pengguna.email,
    nama: pengguna.nama,
    namaLengkap: [pengguna.gelarDepan, pengguna.nama, pengguna.gelarBelakang]
      .filter(Boolean)
      .join(" ")
      .replace(" ,", ","),
    nidn: pengguna.nidn,
    nip: pengguna.nip,
    fotoUrl: pengguna.fotoUrl,
    status: pengguna.status,
    penugasan,
    daftarPeran: [...new Set(penugasan.map((p) => p.peran))],
  };
});

/**
 * Menyiapkan baris Pengguna saat seseorang login untuk pertama kali.
 *
 * Pengguna baru berstatus MENUNGGU_VERIFIKASI: bisa masuk, tapi belum punya
 * peran apa pun sampai admin mengisi NIDN/NIP, peran, dan prodi. Tanpa ini
 * siapa pun yang punya akun Google bisa langsung mengakses data akademik.
 *
 * Pengecualian: email pada ADMIN_BOOTSTRAP_EMAILS langsung aktif sebagai ADMIN,
 * supaya sistem yang baru dipasang punya satu pintu masuk.
 */
export async function siapkanPengguna(input: {
  firebaseUid: string;
  email: string;
  nama?: string | null;
  fotoUrl?: string | null;
}): Promise<{ id: string; status: StatusPengguna; baru: boolean }> {
  const email = input.email.toLowerCase();
  const bootstrapAdmin = env.adminBootstrapEmails.includes(email);

  const adaSebelumnya = await prisma.pengguna.findFirst({
    where: { OR: [{ firebaseUid: input.firebaseUid }, { email }] },
    select: { id: true },
  });

  const pengguna = await prisma.pengguna.upsert({
    where: { firebaseUid: input.firebaseUid },
    update: {
      email,
      fotoUrl: input.fotoUrl ?? undefined,
      terakhirMasuk: new Date(),
    },
    create: {
      firebaseUid: input.firebaseUid,
      email,
      nama: input.nama?.trim() || email.split("@")[0],
      fotoUrl: input.fotoUrl ?? null,
      status: bootstrapAdmin ? "AKTIF" : "MENUNGGU_VERIFIKASI",
      terakhirMasuk: new Date(),
    },
    select: { id: true, status: true },
  });

  if (bootstrapAdmin) {
    // Tidak memakai upsert: pada Postgres, NULL dianggap berbeda satu sama lain
    // di dalam UNIQUE, sehingga @@unique([penggunaId, peran, prodiId]) TIDAK
    // mencegah duplikat ketika prodiId null (peran bercakupan institusi).
    // Pengecekan dilakukan eksplisit di sini; indeks partial untuk kasus null
    // ditambahkan lewat migrasi SQL.
    const sudahAdmin = await prisma.penugasanPeran.findFirst({
      where: { penggunaId: pengguna.id, peran: "ADMIN", prodiId: null },
      select: { id: true },
    });
    if (!sudahAdmin) {
      await prisma.penugasanPeran.create({
        data: { penggunaId: pengguna.id, peran: "ADMIN", prodiId: null },
      });
    }
    if (pengguna.status !== "AKTIF") {
      await prisma.pengguna.update({
        where: { id: pengguna.id },
        data: { status: "AKTIF" },
      });
    }
  }

  return { id: pengguna.id, status: pengguna.status, baru: !adaSebelumnya };
}
