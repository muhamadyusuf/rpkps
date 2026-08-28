import type { KurikulumInput } from "@/domain/kurikulum/tipe";
import {
  butirDipakai,
  ringkasPenerapan,
  type ButirInput,
  type UsulanInput,
} from "@/domain/kurikulum/usulan";
import type { Prisma, PrismaClient } from "@/generated/prisma";

/**
 * Lapisan basis data Usulan Revisi Kurikulum.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §2.4–2.5 dan §4.
 *
 * Semua aturan boleh-tidaknya tinggal di `src/domain/kurikulum/usulan.ts`.
 * Berkas ini hanya mengurus tiga hal yang memang butuh basis data: memuat
 * bentuk domain dari Prisma, menghitung dampak penerapan, dan menerapkan
 * butir yang diterima di dalam satu transaksi.
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`.
 * Alasannya satu: penerapan ke kurikulum adalah bagian paling berisiko dari
 * fitur ini, dan ia harus dapat dijalankan uji integrasi terhadap Postgres
 * tertanam. Pembungkus yang mengikatnya ke klien aplikasi ada di
 * `src/lib/kurikulum/usulan.ts`.
 */

export type Klien = PrismaClient;

export const SERTAKAN_USULAN = {
  kurikulum: {
    select: { id: true, nama: true, tahun: true, revisi: true, prodiId: true },
  },
  mataKuliah: { select: { id: true, kode: true, nama: true, semester: true } },
  diajukanOleh: { select: { id: true, nama: true } },
  diputuskanOleh: { select: { id: true, nama: true } },
  berlakuMulaiTa: { select: { id: true, kode: true } },
  butir: {
    orderBy: { urutan: "asc" },
    include: { dasar: true },
  },
  catatan: {
    orderBy: { dibuatPada: "asc" },
    include: { oleh: { select: { id: true, nama: true } } },
  },
  revisi: { select: { revisiKe: true, ringkasan: true, disahkanSendiri: true } },
} satisfies Prisma.UsulanRevisiInclude;

export type UsulanLengkap = Prisma.UsulanRevisiGetPayload<{
  include: typeof SERTAKAN_USULAN;
}>;

export async function muatUsulan(db: Klien, id: string): Promise<UsulanLengkap | null> {
  return db.usulanRevisi.findUnique({ where: { id }, include: SERTAKAN_USULAN });
}

/**
 * Memuat kurikulum ke bentuk domain.
 *
 * Capaian yang sudah dipensiunkan TIDAK ikut. Kurikulum yang dipakai menilai
 * usulan adalah kurikulum yang berlaku ke depan — CPMK pensiun tidak lagi
 * boleh dihitung sebagai penjabar sebuah CPL, meski barisnya tetap ada demi
 * RPKPS lama yang merujuknya (doc 04 §2.4).
 */
export async function muatKurikulumInput(
  db: Klien,
  kurikulumId: string,
): Promise<KurikulumInput | null> {
  const k = await db.kurikulum.findUnique({
    where: { id: kurikulumId },
    select: {
      nama: true,
      tahun: true,
      cpl: {
        orderBy: { urutan: "asc" },
        select: { id: true, kode: true, deskripsi: true, tingkatKkni: true },
      },
      mataKuliah: {
        orderBy: { kode: "asc" },
        select: {
          id: true,
          kode: true,
          nama: true,
          semester: true,
          sksTeori: true,
          sksPraktik: true,
          cpl: { select: { cpl: { select: { kode: true } } } },
          cpmk: {
            where: { pensiunSejakTaId: null },
            orderBy: { urutan: "asc" },
            select: {
              id: true,
              kode: true,
              rumusan: true,
              levelBloom: true,
              sumber: true,
              cpl: { select: { cpl: { select: { kode: true } } } },
              subCpmk: {
                where: { pensiunSejakTaId: null },
                orderBy: { urutan: "asc" },
                select: {
                  id: true,
                  kode: true,
                  rumusan: true,
                  levelBloom: true,
                  sumber: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!k) return null;

  return {
    nama: k.nama,
    tahun: k.tahun,
    cpl: k.cpl.map((c) => ({
      id: c.id,
      kode: c.kode,
      deskripsi: c.deskripsi,
      tingkatKkni: c.tingkatKkni,
    })),
    mataKuliah: k.mataKuliah.map((m) => ({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
      semester: m.semester,
      sksTeori: m.sksTeori,
      sksPraktik: m.sksPraktik,
      cplKode: m.cpl.map((x) => x.cpl.kode),
      cpmk: m.cpmk.map((c) => ({
        id: c.id,
        kode: c.kode,
        rumusan: c.rumusan,
        levelBloom: c.levelBloom,
        sumberAi: c.sumber === "AI",
        cplKode: c.cpl.map((x) => x.cpl.kode),
        subCpmk: c.subCpmk.map((s) => ({
          id: s.id,
          kode: s.kode,
          rumusan: s.rumusan,
          levelBloom: s.levelBloom,
          sumberAi: s.sumber === "AI",
        })),
      })),
    })),
  };
}

/** Menerjemahkan baris usulan ke bentuk yang dimengerti domain. */
export function keUsulanInput(u: UsulanLengkap): UsulanInput {
  return {
    mkKode: u.mataKuliah.kode,
    jalurRalat: u.jalurRalat,
    butir: u.butir.map(keButirInput),
  };
}

export function keButirInput(b: UsulanLengkap["butir"][number]): ButirInput {
  return {
    id: b.id,
    jenis: b.jenis,
    cpmkKode: b.cpmkKode,
    subCpmkKode: b.subCpmkKode,
    rumusan: b.rumusan,
    levelBloom: b.levelBloom,
    cplKode: b.cplKode,
    mingguDisarankan: b.mingguDisarankan,
    alasan: b.alasan,
    status: b.status,
    dasar: b.dasar.map((d) => ({ jenis: d.jenis, ref: d.ref, kutipan: d.kutipan })),
  };
}

// ─────────────────────────────────────────────────────────────
// Dampak penerapan
// ─────────────────────────────────────────────────────────────

export interface RpkpsTerdampak {
  id: string;
  tahunAkademik: string;
  status: string;
  koordinator: string | null;
}

export interface RujukanPensiun {
  subCpmkKode: string;
  pertemuan: number;
  tugas: number;
  butirKisiKisi: number;
}

export interface DampakUsulan {
  /**
   * RPKPS TERBIT yang memuat mata kuliah ini. Salinan bekunya tidak berubah —
   * yang berubah hanya data langsung, sehingga `periksaPergeseran` akan
   * menyalakan bendera. Daftar ini yang memberi bendera itu penjelasan.
   */
  rpkpsTerbit: RpkpsTerdampak[];
  /** RPKPS yang masih disusun; ini yang benar-benar perlu disesuaikan dosen. */
  rpkpsBerjalan: RpkpsTerdampak[];
  /** Berapa banyak baris RPKPS yang masih merujuk capaian yang dipensiunkan. */
  rujukanPensiun: RujukanPensiun[];
  jumlahButirDipakai: number;
}

export async function dampakUsulan(db: Klien, u: UsulanLengkap): Promise<DampakUsulan> {
  const dipakai = butirDipakai(u.butir.map(keButirInput));

  const rpkps = await db.rpkps.findMany({
    where: { mataKuliahId: u.mataKuliahId },
    orderBy: { tahunAkademik: { kode: "desc" } },
    select: {
      id: true,
      status: true,
      tahunAkademik: { select: { kode: true } },
      pengampu: {
        where: { peran: "KOORDINATOR" },
        select: { pengguna: { select: { nama: true } } },
        take: 1,
      },
    },
  });

  const petakan = (r: (typeof rpkps)[number]): RpkpsTerdampak => ({
    id: r.id,
    tahunAkademik: r.tahunAkademik.kode,
    status: r.status,
    koordinator: r.pengampu[0]?.pengguna.nama ?? null,
  });

  const kodePensiun = dipakai
    .filter((b) => b.jenis === "SUB_PENSIUN")
    .map((b) => b.subCpmkKode)
    .filter((k): k is string => Boolean(k));
  const cpmkPensiun = dipakai
    .filter((b) => b.jenis === "CPMK_PENSIUN")
    .map((b) => b.cpmkKode);

  const subTerdampak = await db.subCpmk.findMany({
    where: {
      cpmk: { mataKuliahId: u.mataKuliahId },
      OR: [
        { kode: { in: kodePensiun } },
        { cpmk: { kode: { in: cpmkPensiun } } },
      ],
    },
    select: {
      kode: true,
      _count: { select: { pertemuan: true, tugas: true, butirUjian: true } },
    },
  });

  return {
    rpkpsTerbit: rpkps.filter((r) => r.status === "TERBIT").map(petakan),
    rpkpsBerjalan: rpkps.filter((r) => r.status !== "TERBIT" && r.status !== "ARSIP").map(petakan),
    rujukanPensiun: subTerdampak
      .map((s) => ({
        subCpmkKode: s.kode,
        pertemuan: s._count.pertemuan,
        tugas: s._count.tugas,
        butirKisiKisi: s._count.butirUjian,
      }))
      .filter((r) => r.pertemuan + r.tugas + r.butirKisiKisi > 0),
    jumlahButirDipakai: dipakai.length,
  };
}

/**
 * Tahun akademik baku mulai berlakunya revisi: TA aktif berikutnya.
 *
 * Bukan TA berjalan — mengubah capaian di tengah semester berarti mahasiswa
 * dinilai atas rumusan yang berbeda dari yang diumumkan di awal (doc 04 §2.5).
 */
export async function taBerlakuBawaan(
  db: Klien,
): Promise<{ id: string; kode: string } | null> {
  const aktif = await db.tahunAkademik.findFirst({
    where: { aktif: true },
    select: { id: true, tahunMulai: true, semester: true },
  });

  const berikutnya = await db.tahunAkademik.findFirst({
    where: aktif
      ? {
          OR: [
            { tahunMulai: { gt: aktif.tahunMulai } },
            { tahunMulai: aktif.tahunMulai, semester: { not: aktif.semester } },
          ],
          tanggalMulai: { not: null },
        }
      : {},
    orderBy: [{ tahunMulai: "asc" }, { semester: "asc" }],
    select: { id: true, kode: true },
  });

  return berikutnya;
}

// ─────────────────────────────────────────────────────────────
// Penerapan
// ─────────────────────────────────────────────────────────────

export interface HasilPenerapan {
  revisiKe: number;
  ringkasan: string;
}

/**
 * Menerapkan butir yang diterima ke kurikulum, dalam satu transaksi.
 *
 * Urutannya meniru `terapkanKeInput` di domain: CPMK baru lebih dulu, lalu
 * Sub-CPMK, lalu sisanya — supaya Sub-CPMK yang induknya lahir di usulan yang
 * sama punya tempat mendarat. Pemanggil WAJIB sudah menjalankan
 * `periksaPenerapan`; fungsi ini tidak menilai boleh atau tidak.
 */
export async function terapkanUsulan(
  db: Klien,
  u: UsulanLengkap,
  olehId: string,
  berlakuMulaiTaId: string | null,
): Promise<HasilPenerapan> {
  const dipakai = butirDipakai(u.butir.map(keButirInput));
  const ringkasan = ringkasPenerapan(u.mataKuliah.kode, dipakai);
  const urutJenis = (b: ButirInput) =>
    b.jenis === "CPMK_BARU" ? 0 : b.jenis === "SUB_BARU" ? 1 : 2;
  const berurut = [...dipakai].sort((a, z) => urutJenis(a) - urutJenis(z));

  return db.$transaction(async (tx) => {
    const kurikulum = await tx.kurikulum.update({
      where: { id: u.kurikulumId },
      data: { revisi: { increment: 1 } },
      select: { revisi: true },
    });

    for (const b of berurut) {
      await terapkanButir(tx, u, b, berlakuMulaiTaId);
    }

    await tx.usulanRevisi.update({
      where: { id: u.id },
      data: {
        status: "DITERAPKAN",
        diterapkanPada: new Date(),
        berlakuMulaiTaId,
      },
    });

    await tx.revisiKurikulum.create({
      data: {
        kurikulumId: u.kurikulumId,
        revisiKe: kurikulum.revisi,
        usulanId: u.id,
        ringkasan,
        // Bukan larangan, penandaan. Di prodi kecil Kaprodi sering satu-satunya
        // yang berwenang; yang tidak boleh adalah menyembunyikannya (doc 04 §8.1).
        disahkanSendiri: u.diajukanOlehId === olehId,
        olehId,
        berlakuMulaiTaId,
      },
    });

    await tx.logAudit.create({
      data: {
        penggunaId: olehId,
        aksi: "USULAN_DITERAPKAN",
        entitas: "usulan_revisi",
        entitasId: u.id,
        ringkasan: `Revisi ${kurikulum.revisi} — ${ringkasan}`,
        data: {
          kurikulumId: u.kurikulumId,
          revisiKe: kurikulum.revisi,
          berlakuMulaiTaId,
          disahkanSendiri: u.diajukanOlehId === olehId,
          butir: dipakai.map((b) => ({
            jenis: b.jenis,
            cpmkKode: b.cpmkKode,
            subCpmkKode: b.subCpmkKode,
          })),
        },
      },
    });

    return { revisiKe: kurikulum.revisi, ringkasan };
  });
}

type Transaksi = Prisma.TransactionClient;

async function terapkanButir(
  tx: Transaksi,
  u: UsulanLengkap,
  b: ButirInput,
  berlakuMulaiTaId: string | null,
) {
  const cpmk = await tx.cpmk.findUnique({
    where: { mataKuliahId_kode: { mataKuliahId: u.mataKuliahId, kode: b.cpmkKode } },
    select: { id: true, urutan: true },
  });

  const tautkan = (data: { cpmkId?: string; subCpmkId?: string }) =>
    tx.butirUsulan.update({ where: { id: b.id }, data });

  switch (b.jenis) {
    case "CPMK_BARU": {
      if (cpmk) return; // sudah ada; periksaPenerapan yang seharusnya menahan
      const terakhir = await tx.cpmk.aggregate({
        where: { mataKuliahId: u.mataKuliahId },
        _max: { urutan: true },
      });
      const baru = await tx.cpmk.create({
        data: {
          mataKuliahId: u.mataKuliahId,
          kode: b.cpmkKode,
          rumusan: b.rumusan ?? "",
          levelBloom: b.levelBloom ?? null,
          urutan: (terakhir._max.urutan ?? 0) + 1,
          sumber: sumberButir(u, b),
          cpl: { create: await pemetaanCpl(tx, u, b.cplKode ?? []) },
        },
        select: { id: true },
      });
      await tautkan({ cpmkId: baru.id });
      return;
    }

    case "CPMK_RUMUSAN": {
      if (!cpmk) return;
      await tx.cpmk.update({
        where: { id: cpmk.id },
        data: {
          rumusan: b.rumusan ?? undefined,
          levelBloom: b.levelBloom ?? undefined,
          sumber: sumberButir(u, b),
        },
      });
      await tautkan({ cpmkId: cpmk.id });
      return;
    }

    case "CPMK_PETA_CPL": {
      if (!cpmk) return;
      await tx.petaCpmkCpl.deleteMany({ where: { cpmkId: cpmk.id } });
      const peta = await pemetaanCpl(tx, u, b.cplKode ?? []);
      for (const p of peta) {
        await tx.petaCpmkCpl.create({ data: { cpmkId: cpmk.id, cplId: p.cplId } });
      }
      await tautkan({ cpmkId: cpmk.id });
      return;
    }

    case "CPMK_PENSIUN": {
      if (!cpmk) return;
      // Menandai, tidak menghapus: Sub-CPMK di bawahnya dirujuk pertemuan,
      // tugas, dan kisi-kisi RPKPS lama dengan onDelete Cascade (doc 04 §2.4).
      await tx.cpmk.update({
        where: { id: cpmk.id },
        data: { pensiunSejakTaId: berlakuMulaiTaId },
      });
      await tx.subCpmk.updateMany({
        where: { cpmkId: cpmk.id },
        data: { pensiunSejakTaId: berlakuMulaiTaId },
      });
      await tautkan({ cpmkId: cpmk.id });
      return;
    }

    case "SUB_BARU": {
      if (!cpmk || !b.subCpmkKode) return;
      const terakhir = await tx.subCpmk.aggregate({
        where: { cpmkId: cpmk.id },
        _max: { urutan: true },
      });
      const baru = await tx.subCpmk.create({
        data: {
          cpmkId: cpmk.id,
          kode: b.subCpmkKode,
          rumusan: b.rumusan ?? "",
          levelBloom: b.levelBloom ?? null,
          mingguDisarankan: b.mingguDisarankan ?? [],
          urutan: (terakhir._max.urutan ?? 0) + 1,
          sumber: sumberButir(u, b),
        },
        select: { id: true },
      });
      await tautkan({ subCpmkId: baru.id });
      return;
    }

    default: {
      if (!cpmk || !b.subCpmkKode) return;
      const sub = await tx.subCpmk.findUnique({
        where: { cpmkId_kode: { cpmkId: cpmk.id, kode: b.subCpmkKode } },
        select: { id: true },
      });
      if (!sub) return;

      if (b.jenis === "SUB_RUMUSAN") {
        await tx.subCpmk.update({
          where: { id: sub.id },
          data: {
            rumusan: b.rumusan ?? undefined,
            levelBloom: b.levelBloom ?? undefined,
            sumber: sumberButir(u, b),
          },
        });
      } else if (b.jenis === "SUB_MINGGU") {
        await tx.subCpmk.update({
          where: { id: sub.id },
          data: { mingguDisarankan: b.mingguDisarankan ?? [] },
        });
      } else if (b.jenis === "SUB_PENSIUN") {
        await tx.subCpmk.update({
          where: { id: sub.id },
          data: { pensiunSejakTaId: berlakuMulaiTaId },
        });
      }
      await tautkan({ subCpmkId: sub.id });
    }
  }
}

/**
 * Asal isi rumusan yang mendarat di kurikulum.
 *
 * Butir yang disesuaikan Kaprodi jadi kalimat Kaprodi, sehingga kembali
 * bersumber KURIKULUM. Butir yang diterima apa adanya dari draf AI tetap
 * ditandai AI meski sudah disahkan — asesor berhak tahu, dan pengesahan
 * manusia adalah jawaban yang kuat (docs/01 §4.8).
 */
function sumberButir(u: UsulanLengkap, b: ButirInput) {
  const asli = u.butir.find((x) => x.id === b.id);
  if (!asli) return "KURIKULUM" as const;
  return asli.status === "DISESUAIKAN" ? ("KURIKULUM" as const) : asli.sumber;
}

async function pemetaanCpl(tx: Transaksi, u: UsulanLengkap, kode: string[]) {
  if (kode.length === 0) return [];
  const cpl = await tx.cpl.findMany({
    where: { kurikulumId: u.kurikulumId, kode: { in: kode } },
    select: { id: true },
  });
  return cpl.map((c) => ({ cplId: c.id }));
}
