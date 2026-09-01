import type { PrismaClient } from "@/generated/prisma";
import type {
  RpkpsPenggantung,
  SensusCpl,
  SensusCpmk,
  SensusMataKuliah,
  SensusSubCpmk,
} from "@/domain/kurikulum/sunting";

/**
 * Lapisan basis data gerbang G2 penyuntingan kurikulum. Acuan: docs/15 §2.3.
 *
 * Seluruh PUTUSAN tinggal di `src/domain/kurikulum/sunting.ts`. Berkas ini
 * hanya menghitung sensusnya.
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`.
 * Alasannya sama dengan `usulan-inti.ts`: sensus inilah yang berdiri di antara
 * satu klik "Hapus" dan lenyapnya RPKPS terbit beserta salinan bekunya, kelas,
 * peserta, dan nilai. Bagian sepenting itu harus dapat dijalankan uji
 * integrasi terhadap Postgres tertanam — sebuah `select` yang salah relasi
 * tidak akan pernah tertangkap oleh uji domain yang datanya dikarang.
 *
 * Pembungkus yang mengikatnya ke klien aplikasi ada di `./sunting.ts`.
 */

export type Klien = PrismaClient;

/**
 * Label RPKPS yang dibaca manusia, bukan id.
 *
 * "TI214 · 2025/2026 GENAP" adalah yang dicari orang saat pesan penolakan
 * menyebut dokumen mana yang menghalangi.
 */
const PILIH_RPKPS = {
  status: true,
  tahunAkademik: { select: { kode: true } },
  mataKuliah: { select: { kode: true } },
  _count: { select: { snapshot: true } },
} as const;

type BarisRpkps = {
  status: string;
  tahunAkademik: { kode: string };
  mataKuliah: { kode: string };
  _count: { snapshot: number };
};

function kePenggantung(r: BarisRpkps): RpkpsPenggantung {
  return {
    label: `${r.mataKuliah.kode} · ${r.tahunAkademik.kode.replace("-", " ")}`,
    status: r.status,
    jumlahSnapshot: r._count.snapshot,
  };
}

export async function sensusMataKuliah(
  db: Klien,
  mataKuliahId: string,
): Promise<SensusMataKuliah | null> {
  const mk = await db.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: { kode: true, rpkps: { select: PILIH_RPKPS } },
  });
  if (!mk) return null;
  return { kode: mk.kode, rpkps: mk.rpkps.map(kePenggantung) };
}

export async function sensusSubCpmk(
  db: Klien,
  subCpmkId: string,
): Promise<SensusSubCpmk | null> {
  const s = await db.subCpmk.findUnique({
    where: { id: subCpmkId },
    select: {
      kode: true,
      _count: { select: { pertemuan: true, tugas: true, butirUjian: true } },
    },
  });
  if (!s) return null;
  return {
    kode: s.kode,
    jumlahPertemuan: s._count.pertemuan,
    jumlahTugas: s._count.tugas,
    jumlahButirKisiKisi: s._count.butirUjian,
  };
}

export async function sensusCpmk(db: Klien, cpmkId: string): Promise<SensusCpmk | null> {
  const c = await db.cpmk.findUnique({
    where: { id: cpmkId },
    select: {
      kode: true,
      mataKuliah: { select: { rpkps: { select: PILIH_RPKPS } } },
      subCpmk: {
        select: {
          kode: true,
          _count: { select: { pertemuan: true, tugas: true, butirUjian: true } },
        },
      },
    },
  });
  if (!c) return null;
  return {
    kode: c.kode,
    rpkps: c.mataKuliah.rpkps.map(kePenggantung),
    subCpmk: c.subCpmk.map((s) => ({
      kode: s.kode,
      jumlahPertemuan: s._count.pertemuan,
      jumlahTugas: s._count.tugas,
      jumlahButirKisiKisi: s._count.butirUjian,
    })),
  };
}

export async function sensusCpl(db: Klien, cplId: string): Promise<SensusCpl | null> {
  const c = await db.cpl.findUnique({
    where: { id: cplId },
    select: {
      kode: true,
      _count: { select: { cpmk: true } },
      // RPKPS pada SETIAP mata kuliah yang dibebani CPL ini — kode dan
      // deskripsi CPL ikut tercetak di dokumennya lewat matriks CPL×MK.
      mataKuliah: {
        select: { mataKuliah: { select: { rpkps: { select: PILIH_RPKPS } } } },
      },
    },
  });
  if (!c) return null;
  return {
    kode: c.kode,
    jumlahCpmk: c._count.cpmk,
    rpkps: c.mataKuliah.flatMap((m) => m.mataKuliah.rpkps.map(kePenggantung)),
  };
}

/**
 * Seluruh RPKPS di bawah satu kurikulum.
 *
 * Dipakai `hapusKurikulum`, yang selama ini hanya menolak status BERLAKU —
 * padahal kurikulum ARSIP pun menjangkau `MataKuliah → Rpkps → RpkpsSnapshot`
 * lewat cascade (docs/15, lampiran).
 */
export async function sensusKurikulum(
  db: Klien,
  kurikulumId: string,
): Promise<RpkpsPenggantung[]> {
  const daftar = await db.rpkps.findMany({
    where: { mataKuliah: { kurikulumId } },
    select: PILIH_RPKPS,
  });
  return daftar.map(kePenggantung);
}

/**
 * Menyetel matriks CPL×MK, sekaligus merapikan peta CPMK×CPL yang ikut basi.
 *
 * `setelCplCpmk` hanya menawarkan CPL yang DIBEBANKAN pada mata kuliah ini,
 * tetapi pembatasan itu berlaku saat memilih — bukan sesudahnya. Melepas
 * sebuah CPL dari mata kuliah tanpa langkah kedua meninggalkan CPMK yang masih
 * menunjuk CPL yang tidak lagi dibebankan padanya: rantai telusur CPL → CPMK
 * menyimpang dari matriks CPL×MK, dan angka ketercapaian CPL prodi menghitung
 * mata kuliah yang tidak pernah dibebani CPL itu. Tidak ada galat — hanya dua
 * tabel yang diam-diam tidak lagi sejalan.
 *
 * Mengembalikan id CPL yang benar-benar dipasang: pemanggil menyaring dari
 * kurikulum yang sama, dan jumlah akhir itulah yang dilaporkan ke pengguna.
 */
export async function setelMatriksCplMk(
  db: Klien,
  mataKuliahId: string,
  idSah: string[],
): Promise<number> {
  await db.$transaction([
    db.matriksCplMk.deleteMany({ where: { mataKuliahId } }),
    db.matriksCplMk.createMany({
      data: idSah.map((cplId) => ({ mataKuliahId, cplId })),
    }),
    // `notIn: []` pada Prisma bernilai SELALU BENAR, jadi melepas seluruh CPL
    // dari mata kuliah ini juga melepas seluruh peta CPMK×CPL di bawahnya —
    // dan itu memang yang benar: tanpa CPL yang dibebankan, tak satu pun
    // pemetaan CPMK→CPL masih sah.
    db.petaCpmkCpl.deleteMany({
      where: { cpmk: { mataKuliahId }, cplId: { notIn: idSah } },
    }),
  ]);
  return idSah.length;
}
