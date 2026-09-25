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
import { PERAN_NON_PEGAWAI, peranLokalBoleh } from "@/domain/identitas/peran";
import { GalatIdentitas } from "@/lib/identitas/klien";
import { cariPegawai, ProfilTidakTersedia, wajibProfil } from "@/lib/identitas/pegawai";
import { periksaStatusKepegawaian } from "@/lib/identitas/status";
import { sinkronkanPengguna, sinkronkanSemua } from "@/lib/identitas/sinkron";
import { gabungNama } from "@/domain/identitas/tampilan";
import { env } from "@/lib/env";
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

export type HasilAksi = { ok: boolean; pesan: string };

/**
 * Hanya pengguna LOKAL (asesor/mahasiswa) yang namanya disimpan di sini. Nama, gelar, NIDN, dan NIP
 * pegawai dimiliki identitas-itts (docs/26 §4) — mengubahnya dari sini hanya menimbulkan salinan
 * yang bertentangan, jadi aksinya menolak, bukan mengabaikan diam-diam.
 */
export async function perbaruiNamaLokal(penggunaId: string, data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = z.object({ nama: z.string().trim().min(2, "@aksi.periksa.namaMinimal") }).safeParse({ nama: data.get("nama") });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const p = await prisma.pengguna.findUnique({ where: { id: penggunaId }, select: { identitasAkunId: true } });
  if (!p) return { ok: false, pesan: kam.aksi.umum.dataTidakValid };
  if (p.identitasAkunId) return { ok: false, pesan: kam.aksi.pengguna.namaDariIdentitas };

  await prisma.pengguna.update({ where: { id: penggunaId }, data: { nama: parsed.data.nama } });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PROFIL_DIPERBARUI",
      entitas: "pengguna",
      entitasId: penggunaId,
      ringkasan: `${sesi.email} memperbarui nama pengguna lokal`,
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
  peran: z.enum(["ASESOR", "MAHASISWA"]),
  prodiId: opsional,
});

/**
 * Admin membuat akun NON-PEGAWAI (asesor eksternal, mahasiswa) langsung, lengkap dengan peran.
 * Pegawai TIDAK dibuat dari sini: mereka datang dari identitas-itts (`tambahPegawai`).
 *
 * Baris `Pengguna` dibuat berstatus AKTIF dengan uid Firebase sementara (`firebaseUidUndangan`);
 * `siapkanPengguna` menautkannya ke uid Firebase yang asli pada percobaan masuk pertama
 * pemiliknya, dicocokkan lewat email. Peran wajib: pengguna lokal tanpa peran tak lolos gerbang
 * masuk (`bolehLewatGerbangLokal`).
 */
export async function tambahPengguna(data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaTambahPengguna.safeParse({
    email: data.get("email"),
    nama: data.get("nama"),
    peran: data.get("peran"),
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

  if (!PERAN_INSTITUSI.includes(peran) && !prodiId) {
    return { ok: false, pesan: kam.aksi.pengguna.peranButuhProdi };
  }

  // Satu orang, satu tempat: yang terdaftar sebagai pegawai di identitas-itts ditambahkan lewat
  // pemilih pegawai, supaya tak ada dua baris (satu lokal, satu bertaut) untuk orang yang sama.
  // Bila identitas-itts tak terjangkau, penambahan tetap jalan — ini bukan gerbang keamanan.
  if (env.identitasItts) {
    try {
      const status = await periksaStatusKepegawaian(email);
      if (status.diperiksa && status.terdaftar) {
        return { ok: false, pesan: kam.aksi.pengguna.terdaftarSebagaiPegawai };
      }
    } catch {
      // dibiarkan
    }
  }

  const pengguna = await prisma.pengguna.create({
    data: {
      firebaseUid: firebaseUidUndangan(),
      email,
      nama,
      status: "AKTIF",
      penugasan: {
        create: {
          peran,
          prodiId: !PERAN_INSTITUSI.includes(peran) ? prodiId : null,
        },
      },
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

export interface PegawaiPilihan {
  akunId: string;
  email: string;
  namaLengkap: string;
  nomorInduk: string | null;
  aktif: boolean;
  /** Sudah punya baris pengguna di RPKPS — tak dapat ditambahkan lagi. */
  sudahAda: boolean;
}

export type HasilCariPegawai = { ok: true; pegawai: PegawaiPilihan[] } | { ok: false; pesan: string };

/** Pemilih pegawai: mencari di identitas-itts (nama, surel, NIDN, NIP). */
export async function cariPegawaiPemilih(kata: string): Promise<HasilCariPegawai> {
  const kam = await kamusAksi();
  await wajibPeran("ADMIN");

  if (!env.identitasItts) return { ok: false, pesan: kam.aksi.pengguna.identitasBelumAktif };

  let hasil;
  try {
    hasil = await cariPegawai(kata);
  } catch (galat) {
    return { ok: false, pesan: pesanGalatIdentitas(galat, kam.aksi.pengguna.identitasGagal) };
  }

  const ada = await prisma.pengguna.findMany({
    where: { OR: [{ identitasAkunId: { in: hasil.map((p) => p.akunId) } }, { email: { in: hasil.map((p) => p.email) } }] },
    select: { email: true, identitasAkunId: true },
  });
  const akunAda = new Set(ada.flatMap((a) => (a.identitasAkunId ? [a.identitasAkunId] : [])));
  const suratAda = new Set(ada.map((a) => a.email.toLowerCase()));

  return {
    ok: true,
    pegawai: hasil.map((p) => ({
      akunId: p.akunId,
      email: p.email,
      namaLengkap: gabungNama({ nama: p.namaLengkap, gelarDepan: p.gelarDepan, gelarBelakang: p.gelarBelakang }),
      nomorInduk: p.nidn ?? p.nip,
      aktif: p.aktif,
      sudahAda: akunAda.has(p.akunId) || suratAda.has(p.email.toLowerCase()),
    })),
  };
}

/** Pesan galat identitas-itts untuk admin: sebabnya (cakupan, kredensial, padam) dibedakan, karena tindakannya berbeda. */
function pesanGalatIdentitas(galat: unknown, cadangan: string): string {
  return galat instanceof GalatIdentitas ? `${cadangan} (${galat.message})` : cadangan;
}

/**
 * Menambahkan pegawai dari identitas-itts sebagai pengguna RPKPS. Yang disimpan hanya kunci
 * (`identitasAkunId`) dan surel; nama dan jabatannya tetap dibaca dari sana. Perannya langsung
 * diturunkan dari jabatan (`sinkronkanPengguna`) — pegawai tanpa jabatan yang dipetakan tetap
 * MENUNGGU_VERIFIKASI sampai admin memberi peran lokal.
 */
export async function tambahPegawai(akunId: string): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  if (typeof akunId !== "string" || akunId.length === 0 || akunId.length > 64) {
    return { ok: false, pesan: kam.aksi.umum.dataTidakValid };
  }
  if (!env.identitasItts) return { ok: false, pesan: kam.aksi.pengguna.identitasBelumAktif };

  // Data SEGAR dan pasti: pegawai yang ditambahkan harus benar-benar ada dan aktif sekarang.
  let profil;
  try {
    profil = (await wajibProfil([akunId])).get(akunId);
  } catch (galat) {
    if (galat instanceof ProfilTidakTersedia) return { ok: false, pesan: kam.aksi.pengguna.pegawaiTakDitemukan };
    return { ok: false, pesan: kam.aksi.pengguna.identitasGagal };
  }
  if (!profil) return { ok: false, pesan: kam.aksi.pengguna.pegawaiTakDitemukan };
  if (!profil.aktif) return { ok: false, pesan: kam.aksi.pengguna.pegawaiNonaktif };

  const email = profil.email.toLowerCase();
  const sudahAda = await prisma.pengguna.findFirst({
    where: { OR: [{ identitasAkunId: akunId }, { email }] },
    select: { id: true },
  });
  if (sudahAda) return { ok: false, pesan: kam.aksi.pengguna.emailSudahTerdaftar };

  const pengguna = await prisma.pengguna.create({
    data: {
      firebaseUid: firebaseUidUndangan(),
      email,
      // `nama` masih NOT NULL sampai kontraksi (docs/26 §7): penampung dari surel, tak pernah ditampilkan.
      nama: email.split("@")[0],
      identitasAkunId: akunId,
      status: "MENUNGGU_VERIFIKASI",
    },
  });

  const hasil = await sinkronkanPengguna(pengguna.id);

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PENGGUNA_DITAMBAHKAN",
      entitas: "pengguna",
      entitasId: pengguna.id,
      ringkasan: `${sesi.email} menambahkan pegawai ${email} dari identitas-itts`,
    },
  });

  segarkan("/pengguna");
  return {
    ok: true,
    pesan: sisip(hasil && hasil.ditambah + hasil.dipromosi > 0 ? kam.aksi.pengguna.pegawaiDitambahkan : kam.aksi.pengguna.pegawaiDitambahkanTanpaPeran, { email }),
  };
}

export async function tambahPeran(
  penggunaId: string,
  peran: Peran,
  prodiId: string | null,
): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const pengguna = await prisma.pengguna.findUnique({ where: { id: penggunaId }, select: { identitasAkunId: true } });
  if (!pengguna) return { ok: false, pesan: kam.aksi.takAda.penugasan };
  if (!peranLokalBoleh(pengguna.identitasAkunId !== null, peran)) {
    return { ok: false, pesan: kam.aksi.pengguna.peranTidakBolehLokal };
  }

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

  // Baris yang dibuat admin selalu LOKAL — sinkron tak pernah menghapusnya (docs/26 §5).
  await prisma.penugasanPeran.create({
    data: { penggunaId, peran, prodiId: prodiFinal, sumber: "LOKAL" },
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
    select: { id: true, penggunaId: true, peran: true, sumber: true },
  });
  if (!penugasan) return { ok: false, pesan: kam.aksi.takAda.penugasan };

  // Peran yang diturunkan dari jabatan dimiliki identitas-itts: menghapusnya di sini hanya
  // bertahan sampai sinkron berikutnya, dan memberi kesan peran itu sudah dicabut padahal belum.
  if (penugasan.sumber === "IDENTITAS") {
    return { ok: false, pesan: kam.aksi.pengguna.peranDariIdentitas };
  }

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

/** Tombol admin "Sinkronkan sekarang": menyelaraskan peran SEMUA pegawai (sama dengan cron harian). */
export async function sinkronkanSekarang(): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  if (!env.identitasItts) return { ok: false, pesan: kam.aksi.pengguna.identitasBelumAktif };

  let laporan;
  try {
    laporan = await sinkronkanSemua();
  } catch (galat) {
    return { ok: false, pesan: pesanGalatIdentitas(galat, kam.aksi.pengguna.sinkronGagal) };
  }

  if (laporan.ditolak) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.pengguna.sinkronDitolak, { akanHapus: laporan.ditolak.akanHapus, batas: laporan.ditolak.batas }),
    };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "SINKRON_PERAN",
      entitas: "pengguna",
      ringkasan: `${sesi.email} menyinkronkan peran dari identitas-itts (${laporan.pegawaiDiproses} pegawai, +${laporan.ditambah} −${laporan.dihapus})`,
    },
  });

  segarkan("/pengguna");
  const unit = laporan.unitTakTerpetakan;
  return {
    ok: true,
    pesan:
      sisip(kam.aksi.pengguna.sinkronSelesai, {
        pegawai: laporan.pegawaiDiproses,
        baru: laporan.penggunaBaru,
        ditambah: laporan.ditambah,
        dihapus: laporan.dihapus,
      }) +
      (unit.length > 0
        ? sisip(kam.aksi.pengguna.sinkronUnitBelumDipetakan, { jumlah: unit.length, unit: unit.slice(0, 5).join(", ") })
        : ""),
  };
}

/** Menyegarkan peran SATU pegawai — dari halaman detailnya. */
export async function sinkronkanPenggunaIni(penggunaId: string): Promise<HasilAksi> {
  const kam = await kamusAksi();
  await wajibPeran("ADMIN");

  const hasil = await sinkronkanPengguna(penggunaId);
  if (!hasil) return { ok: false, pesan: kam.aksi.pengguna.sinkronGagal };

  segarkan(`/pengguna/${penggunaId}`);
  segarkan("/pengguna");
  return { ok: true, pesan: kam.aksi.pengguna.sinkronPenggunaSelesai };
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

  const diproses: (BarisPenggunaSiap & { peran: Peran })[] = [];
  const emailDiproses = new Set<string>();
  for (const b of baris) {
    const email = String(b.email).trim().toLowerCase();
    if (!email || sudahAdaSet.has(email) || emailDiproses.has(email)) continue;
    if (b.prodiId && !prodiValid.has(b.prodiId)) continue;
    // Data dari klien tidak dipercaya: impor hanya untuk non-pegawai, dan MAHASISWA wajib berprodi.
    if (!b.peran || !PERAN_NON_PEGAWAI.includes(b.peran)) continue;
    if (!PERAN_INSTITUSI.includes(b.peran) && !b.prodiId) continue;
    diproses.push({ ...b, email, peran: b.peran });
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
          penugasan: {
            create: {
              peran: b.peran,
              prodiId: !PERAN_INSTITUSI.includes(b.peran) ? b.prodiId : null,
            },
          },
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

