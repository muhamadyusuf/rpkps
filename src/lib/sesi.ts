import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { verifikasiCookieSesi } from "@/lib/firebase/admin";
import type { Peran, StatusPengguna } from "@/generated/prisma";
import type { Bahasa } from "@/kamus";

export const NAMA_COOKIE_SESI = "sesi";

/**
 * Awalan uid sementara untuk akun yang disiapkan admin lewat `/pengguna`
 * sebelum pemiliknya pernah masuk sekali pun. `firebaseUid` wajib unik dan
 * tidak boleh kosong, jadi baris itu butuh sesuatu di kolom ini — nilai yang
 * TIDAK PERNAH dapat keluar dari Firebase asli, supaya tertaut dengan tepat
 * satu kali pada percobaan masuk pertama (lihat `siapkanPengguna`).
 */
const AWALAN_UID_UNDANGAN = "undangan:";

export function firebaseUidUndangan(): string {
  return `${AWALAN_UID_UNDANGAN}${randomUUID()}`;
}

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
 * Pengecualian pertama: email pada ADMIN_BOOTSTRAP_EMAILS langsung aktif
 * sebagai ADMIN, supaya sistem yang baru dipasang punya satu pintu masuk.
 *
 * Pengecualian kedua: bila admin sudah menambahkan pengguna ini lebih dulu
 * lewat `/pengguna` (statusnya sudah AKTIF, perannya sudah ditetapkan),
 * masuk pertama kali hanya menautkan uid Firebase-nya \u2014 bukan menunggu
 * verifikasi lagi. Lihat `firebaseUidUndangan`.
 */
export async function siapkanPengguna(input: {
  firebaseUid: string;
  email: string;
  nama?: string | null;
  fotoUrl?: string | null;
}): Promise<{ id: string; status: StatusPengguna; baru: boolean; bahasa: Bahasa }> {
  const email = input.email.toLowerCase();
  const bootstrapAdmin = env.adminBootstrapEmails.includes(email);

  const adaSebelumnya = await prisma.pengguna.findFirst({
    where: { OR: [{ firebaseUid: input.firebaseUid }, { email }] },
    select: { id: true, firebaseUid: true },
  });

  let pengguna: { id: string; status: StatusPengguna; bahasa: Bahasa };

  if (adaSebelumnya && adaSebelumnya.firebaseUid.startsWith(AWALAN_UID_UNDANGAN)) {
    // Admin sudah menyiapkan akun ini lebih dulu (peran dan status sudah
    // ditentukan) — tautkan uid Firebase yang sebenarnya di sini, jangan
    // membuat baris kedua. Baris kedua itu toh akan ditolak constraint unique
    // pada email.
    pengguna = await prisma.pengguna.update({
      where: { id: adaSebelumnya.id },
      data: {
        firebaseUid: input.firebaseUid,
        fotoUrl: input.fotoUrl ?? undefined,
        terakhirMasuk: new Date(),
      },
      select: { id: true, status: true, bahasa: true },
    });
  } else {
    pengguna = await prisma.pengguna.upsert({
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
      select: { id: true, status: true, bahasa: true },
    });
  }

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

  return {
    id: pengguna.id,
    status: pengguna.status,
    baru: !adaSebelumnya,
    bahasa: pengguna.bahasa,
  };
}
