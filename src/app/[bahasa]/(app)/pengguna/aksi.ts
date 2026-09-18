"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { Peran, StatusPengguna } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import { firebaseUidUndangan } from "@/lib/sesi";
import { PERAN_INSTITUSI } from "@/domain/pengguna/peran";
import {
  rakitPenggunaImpor,
  type BarisPenggunaSiap,
  type GalatBarisPengguna,
} from "@/domain/pengguna/impor";
import { bacaBerkasPengguna } from "@/lib/pengguna/excel";

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

const SkemaTambahPengguna = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("@aksi.periksa.emailTidakValid"),
  nama: z.string().trim().min(2, "@aksi.periksa.namaMinimal"),
  peran: z.nativeEnum(Peran).nullable(),
  prodiId: opsional,
});

/**
 * Admin membuat akun langsung, lengkap dengan peran — pemiliknya tidak perlu
 * mendaftar sendiri lalu menunggu diverifikasi. Baris `Pengguna` dibuat
 * berstatus AKTIF dengan uid Firebase sementara (`firebaseUidUndangan`);
 * `siapkanPengguna` menautkannya ke uid Firebase yang asli pada percobaan
 * masuk pertama pemiliknya, dicocokkan lewat email.
 */
export async function tambahPengguna(data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const peranMentah = data.get("peran");
  const parsed = SkemaTambahPengguna.safeParse({
    email: data.get("email"),
    nama: data.get("nama"),
    peran: peranMentah ? peranMentah : null,
    prodiId: data.get("prodiId"),
  });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const { email, nama, peran, prodiId } = parsed.data;

  const sudahAda = await prisma.pengguna.findUnique({
    where: { email },
    select: { id: true },
  });
  if (sudahAda) {
    return { ok: false, pesan: kam.aksi.pengguna.emailSudahTerdaftar };
  }

  if (peran) {
    const butuhProdi = !PERAN_INSTITUSI.includes(peran);
    if (butuhProdi && !prodiId) {
      return { ok: false, pesan: kam.aksi.pengguna.peranButuhProdi };
    }
  }

  const pengguna = await prisma.pengguna.create({
    data: {
      firebaseUid: firebaseUidUndangan(),
      email,
      nama,
      status: "AKTIF",
      penugasan: peran
        ? {
            create: {
              peran,
              prodiId: !PERAN_INSTITUSI.includes(peran) ? prodiId : null,
            },
          }
        : undefined,
    },
  });

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PENGGUNA_DITAMBAHKAN",
      entitas: "pengguna",
      entitasId: pengguna.id,
      ringkasan: `${sesi.email} menambahkan pengguna ${email}`,
    },
  });

  segarkan("/pengguna");
  return { ok: true, pesan: sisip(kam.aksi.pengguna.penggunaDitambahkan, { email }) };
}

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

const UKURAN_MAKS_PENGGUNA = 5 * 1024 * 1024; // 5 MB

export interface HasilPraTinjauPengguna {
  ok: boolean;
  pesan?: string;
  siap?: BarisPenggunaSiap[];
  galat?: GalatBarisPengguna[];
}

/**
 * Membaca berkas impor pengguna dan memvalidasinya TANPA menyimpan apa pun.
 * Email yang sudah terdaftar di basis data dipindah menjadi galat baris di
 * sini — pemeriksaan format murni (`rakitPenggunaImpor`) tidak menyentuh
 * basis data.
 */
export async function praTinjauImporPengguna(data: FormData): Promise<HasilPraTinjauPengguna> {
  const kam = await kamusAksi();
  await wajibPeran("ADMIN");

  const berkas = data.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { ok: false, pesan: kam.aksi.berkas.pilihExcel };
  }
  if (berkas.size > UKURAN_MAKS_PENGGUNA) {
    return { ok: false, pesan: kam.aksi.berkas.ukuranMelebihi5mb };
  }
  if (!berkas.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, pesan: kam.aksi.berkas.harusXlsx };
  }

  let mentah;
  try {
    mentah = await bacaBerkasPengguna(await berkas.arrayBuffer());
  } catch {
    return { ok: false, pesan: kam.aksi.berkas.takTerbaca };
  }
  if (mentah.length === 0) {
    return { ok: false, pesan: kam.aksi.lain.imporLembarKosong };
  }

  const prodi = await prisma.prodi.findMany({
    where: { aktif: true },
    select: { id: true, kode: true },
  });

  const { siap, galat } = rakitPenggunaImpor(mentah, prodi);

  if (siap.length > 0) {
    const sudahAda = await prisma.pengguna.findMany({
      where: { email: { in: siap.map((b) => b.email) } },
      select: { email: true },
    });
    const sudahAdaSet = new Set(sudahAda.map((p) => p.email.toLowerCase()));
    const siapAkhir: BarisPenggunaSiap[] = [];
    for (const b of siap) {
      if (sudahAdaSet.has(b.email)) {
        galat.push({ baris: b.baris, pesan: `Email "${b.email}" sudah terdaftar.` });
      } else {
        siapAkhir.push(b);
      }
    }
    galat.sort((a, b) => a.baris - b.baris);
    return { ok: true, siap: siapAkhir, galat };
  }

  return { ok: true, siap, galat };
}

export interface HasilSimpanImporPengguna {
  ok: boolean;
  pesan: string;
  jumlahDitambahkan?: number;
  jumlahDilewati?: number;
}

/**
 * Menyimpan baris pengguna hasil impor.
 *
 * Divalidasi ULANG di sini, bukan sekadar percaya pada hasil pratinjau —
 * data yang dikirim klien tidak boleh dipercaya begitu saja. Baris yang
 * emailnya sudah terdaftar (mis. dua orang mengimpor berkas yang tumpang
 * tindih) dilewati, bukan menggagalkan seluruh impor.
 */
export async function simpanImporPengguna(
  baris: BarisPenggunaSiap[],
): Promise<HasilSimpanImporPengguna> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  if (!Array.isArray(baris) || baris.length === 0) {
    return { ok: false, pesan: kam.aksi.pengguna.imporTanpaBarisSiap };
  }

  const emailUnik = Array.from(new Set(baris.map((b) => String(b.email).trim().toLowerCase())));
  const sudahAda = await prisma.pengguna.findMany({
    where: { email: { in: emailUnik } },
    select: { email: true },
  });
  const sudahAdaSet = new Set(sudahAda.map((p) => p.email.toLowerCase()));

  const prodiId = Array.from(
    new Set(baris.map((b) => b.prodiId).filter((id): id is string => Boolean(id))),
  );
  const prodiValid = new Set(
    (
      await prisma.prodi.findMany({ where: { id: { in: prodiId } }, select: { id: true } })
    ).map((p) => p.id),
  );

  const diproses: BarisPenggunaSiap[] = [];
  const emailDiproses = new Set<string>();
  for (const b of baris) {
    const email = String(b.email).trim().toLowerCase();
    if (!email || sudahAdaSet.has(email) || emailDiproses.has(email)) continue;
    if (b.prodiId && !prodiValid.has(b.prodiId)) continue;
    diproses.push({ ...b, email });
    emailDiproses.add(email);
  }

  const dilewati = baris.length - diproses.length;
  if (diproses.length === 0) {
    return { ok: false, pesan: kam.aksi.pengguna.imporTanpaBarisSiap };
  }

  await prisma.$transaction(
    diproses.map((b) =>
      prisma.pengguna.create({
        data: {
          firebaseUid: firebaseUidUndangan(),
          email: b.email,
          nama: b.nama,
          status: "AKTIF",
          penugasan: b.peran
            ? {
                create: {
                  peran: b.peran,
                  prodiId: !PERAN_INSTITUSI.includes(b.peran) ? b.prodiId : null,
                },
              }
            : undefined,
        },
      }),
    ),
  );

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PENGGUNA_DIIMPOR",
      entitas: "pengguna",
      ringkasan: `${sesi.email} mengimpor ${diproses.length} pengguna`,
    },
  });

  segarkan("/pengguna");

  const pesan =
    dilewati > 0
      ? sisip(kam.aksi.pengguna.imporSelesaiSebagian, { jumlah: diproses.length, dilewati })
      : sisip(kam.aksi.pengguna.imporSelesai, { jumlah: diproses.length });

  return { ok: true, pesan, jumlahDitambahkan: diproses.length, jumlahDilewati: dilewati };
}

