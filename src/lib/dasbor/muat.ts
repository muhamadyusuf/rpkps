import "server-only";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran } from "@/lib/otorisasi";
import { muatBarisCapaian, muatKonteksProdi } from "@/lib/evaluasi/muat";
import { agregasiProdi, type SebaranKelas } from "@/domain/evaluasi/agregasi";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import {
  denyutHarian,
  kelengkapanRpkps,
  persen,
  sebaranStatus,
  tahapKelas,
  type DefinisiSegmen,
  type HasilKelengkapan,
  type HasilTahapKelas,
  type Segmen,
  type TitikDenyut,
} from "@/domain/dasbor/ringkasan";
import {
  susunAntrian,
  SUMBER_KOSONG,
  type ButirAntrian,
  type SumberAntrian,
} from "@/domain/dasbor/antrian";
import type { PenggunaSesi } from "@/lib/sesi";
import type { StatusRpkps } from "@/generated/prisma";

/**
 * Pemuatan data dasbor — docs/07-dasbor-peran.md §4.
 *
 * Satu berkas, satu tanggung jawab: mengubah kueri Prisma menjadi bentuk yang
 * sudah siap digambar. Tidak ada rumus di sini — capaian datang dari
 * `agregasiProdi`, bobot dari `susunPetaAsesmen`, dan bentuk ringkasnya dari
 * `src/domain/dasbor`.
 *
 * Cakupan prodi ditegakkan di setiap kueri lewat `cakupanProdi(sesi)`, bukan
 * disaring belakangan di tampilan. Peran bercakupan institusi mendapat `null`
 * yang berarti "semua prodi".
 */

export const AMBANG_PRODI = 85;
const HARI_DENYUT = 14;
/** Batas daftar supaya dasbor tetap ringan; sisanya dibaca di halaman modul. */
const BATAS = 12;

const SEGMEN_RPKPS: readonly DefinisiSegmen[] = [
  { kunci: "DRAF", label: "Draf", nada: "netral" },
  { kunci: "DIAJUKAN", label: "Diajukan", nada: "cahaya" },
  { kunci: "DIREVISI", label: "Perlu revisi", nada: "bahaya" },
  { kunci: "DISETUJUI", label: "Disetujui", nada: "peringatan" },
  { kunci: "TERBIT", label: "Terbit", nada: "sukses" },
];

const SEGMEN_KURIKULUM: readonly DefinisiSegmen[] = [
  { kunci: "DRAF", label: "Draf", nada: "netral" },
  { kunci: "BERLAKU", label: "Berlaku", nada: "sukses" },
  { kunci: "ARSIP", label: "Arsip", nada: "peringatan" },
];

// ─────────────────────────────────────────────────────────────
// Bentuk data tiap panel
// ─────────────────────────────────────────────────────────────

export interface DataProdi {
  prodi: { id: string; kode: string; nama: string };
  kurikulum: { nama: string; tahun: number } | null;
  corong: Segmen[];
  mkTanpaRpkps: number;
  jumlahMk: number;
  cakupanPersen: number;
  cplTerukur: number;
  cplDibebankan: number;
  cpl: {
    kode: string;
    deskripsi: string;
    persenLulus: number | null;
    kelasTerukur: number;
  }[];
  trenLabel: string[];
  tren: { kode: string; titik: (number | null)[] }[];
  sebaran: SebaranKelas[];
  usulanMenunggu: number;
  rpkpsMenunggu: number;
  kelasBelumDitutup: number;
}

export interface BarisMutu {
  prodi: { id: string; kode: string; nama: string };
  rpkpsTerbit: number;
  rpkpsTotal: number;
  cakupanEvaluasi: number;
  cplTercapai: number;
  cplDibebankan: number;
}

export interface DataMutu {
  baris: BarisMutu[];
  cakupanInstitusi: number;
  mkDievaluasi: number;
  mkSeluruh: number;
  temuan: { belum: number; tercapai: number; tidakTercapai: number };
  temuanTerbuka: {
    id: string;
    kode: string;
    tingkat: string;
    mk: string;
    kelas: string;
    tindakan: string;
    penanggungJawab: string | null;
  }[];
}

export interface BarisRpkpsDosen {
  id: string;
  kode: string;
  nama: string;
  tahunAkademik: string;
  status: StatusRpkps;
  koordinator: boolean;
  kelengkapan: HasilKelengkapan;
}

export interface BarisKelasDosen {
  id: string;
  rpkpsId: string;
  kode: string;
  mk: string;
  tahunAkademik: string;
  jumlahPeserta: number;
  tahap: HasilTahapKelas;
}

export interface DataDosen {
  rpkps: BarisRpkpsDosen[];
  kelas: BarisKelasDosen[];
  temuan: {
    id: string;
    kode: string;
    tingkat: string;
    mk: string;
    tindakan: string;
    taSasaran: string | null;
  }[];
  usulan: { id: string; judul: string; status: string; mk: string }[];
}

export interface DataAdmin {
  jumlahProdi: number;
  jumlahPengguna: number;
  menungguVerifikasi: number;
  jumlahTahun: number;
  sebaranPeran: { peran: string; jumlah: number }[];
  statusKurikulum: Segmen[];
  denyut: TitikDenyut[];
  prodiTanpaKaprodi: string[];
}

export interface DataAsesor {
  rpkpsTerbit: number;
  snapshotRpkps: number;
  evaluasiDitutup: number;
  snapshotEvaluasi: number;
  prodi: { kode: string; nama: string; terbit: number }[];
}

export interface DataMahasiswa {
  prodi: { kode: string; nama: string } | null;
  terbit: number;
}

export interface DataDasbor {
  tahunAktif: { id: string; kode: string } | null;
  kebijakan: { id: string; nama: string; status: string } | null;
  antrian: ButirAntrian[];
  prodi: DataProdi[];
  mutu: DataMutu | null;
  dosen: DataDosen | null;
  admin: DataAdmin | null;
  asesor: DataAsesor | null;
  mahasiswa: DataMahasiswa | null;
}

// ─────────────────────────────────────────────────────────────
// Orkestrasi
// ─────────────────────────────────────────────────────────────

export async function muatDasbor(sesi: PenggunaSesi): Promise<DataDasbor> {
  const cakupan = cakupanProdi(sesi);
  const adalahAdmin = punyaPeran(sesi, "ADMIN");
  const adalahMutu = punyaPeran(sesi, "GPM");
  const adalahKaprodi = punyaPeran(sesi, "KAPRODI");
  const adalahPengampu = punyaPeran(sesi, "KOORDINATOR_MK", "DOSEN");
  const adalahAsesor = punyaPeran(sesi, "ASESOR");
  const adalahMahasiswa = punyaPeran(sesi, "MAHASISWA");

  const [tahunAktif, kebijakan] = await Promise.all([
    prisma.tahunAkademik.findFirst({
      where: { aktif: true },
      select: { id: true, kode: true },
    }),
    prisma.kebijakanBebanBelajar.findFirst({
      orderBy: { dibuatPada: "desc" },
      select: { id: true, nama: true, status: true },
    }),
  ]);

  // Prodi yang panel Kaprodi-nya perlu digambar: hanya yang benar-benar
  // dipimpin, bukan seluruh cakupan baca.
  const prodiKaprodi = adalahKaprodi
    ? [
        ...new Set(
          sesi.penugasan
            .filter((p) => p.peran === "KAPRODI" && p.prodiId)
            .map((p) => p.prodiId as string),
        ),
      ]
    : [];

  const [prodi, mutu, dosen, admin, asesor, mahasiswa] = await Promise.all([
    Promise.all(prodiKaprodi.map((id) => muatPanelProdi(id, tahunAktif?.id ?? null))),
    adalahMutu || adalahAdmin ? muatPanelMutu(cakupan, tahunAktif?.id ?? null) : null,
    adalahPengampu || adalahKaprodi ? muatPanelDosen(sesi) : null,
    adalahAdmin ? muatPanelAdmin() : null,
    adalahAsesor ? muatPanelAsesor(cakupan) : null,
    adalahMahasiswa ? muatPanelMahasiswa(sesi) : null,
  ]);

  const antrian = susunAntrian(
    await muatSumberAntrian(sesi, {
      cakupan,
      adalahAdmin,
      adalahMutu,
      kebijakanDraf: kebijakan?.status === "DRAF",
      dosen,
    }),
  );

  // Kaprodi yang tidak mengampu apa pun tidak diberi panel dosen yang kosong.
  // Bagi DOSEN/KOORDINATOR_MK panel itu tetap digambar meski kosong: keadaan
  // "Anda belum terdaftar sebagai pengampu" justru yang perlu dibaca.
  const dosenTampil =
    dosen && (adalahPengampu || dosen.rpkps.length > 0 || dosen.temuan.length > 0 || dosen.usulan.length > 0)
      ? dosen
      : null;

  return {
    tahunAktif,
    kebijakan,
    antrian,
    prodi: prodi.filter((p): p is DataProdi => p !== null),
    mutu,
    dosen: dosenTampil,
    admin,
    asesor,
    mahasiswa,
  };
}

// ─────────────────────────────────────────────────────────────
// Antrian kerja
// ─────────────────────────────────────────────────────────────

async function muatSumberAntrian(
  sesi: PenggunaSesi,
  opsi: {
    cakupan: string[] | null;
    adalahAdmin: boolean;
    adalahMutu: boolean;
    kebijakanDraf: boolean;
    dosen: DataDosen | null;
  },
): Promise<SumberAntrian> {
  const bolehMemutus = punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM");
  const filterProdi =
    opsi.cakupan === null ? {} : { prodiId: { in: opsi.cakupan } };

  const [usulanMenunggu, rpkpsMenunggu, penggunaMenunggu, temuanSaya] =
    await Promise.all([
      bolehMemutus
        ? prisma.usulanRevisi.count({
            where: { status: "DIAJUKAN", kurikulum: filterProdi },
          })
        : 0,
      bolehMemutus
        ? prisma.rpkps.count({
            where: { status: "DIAJUKAN", mataKuliah: { kurikulum: filterProdi } },
          })
        : 0,
      opsi.adalahAdmin
        ? prisma.pengguna.count({ where: { status: "MENUNGGU_VERIFIKASI" } })
        : 0,
      prisma.temuanEvaluasi.count({
        where: { penanggungJawabId: sesi.id, statusVerifikasi: "BELUM" },
      }),
    ]);

  return {
    ...SUMBER_KOSONG,
    usulanMenungguKeputusan: usulanMenunggu,
    rpkpsMenungguKeputusan: rpkpsMenunggu,
    rpkpsDikembalikan:
      opsi.dosen?.rpkps.filter((r) => r.status === "DIREVISI").length ?? 0,
    rpkpsDraf: opsi.dosen?.rpkps.filter((r) => r.status === "DRAF").length ?? 0,
    penggunaMenungguVerifikasi: penggunaMenunggu,
    temuanBelumDiverifikasi: temuanSaya,
    kelasSiapDitutup:
      opsi.dosen?.kelas.filter((k) => k.tahap.tahap === "SIAP_HITUNG").length ?? 0,
    kebijakanMasihDraf:
      opsi.kebijakanDraf && (opsi.adalahAdmin || opsi.adalahMutu),
  };
}

// ─────────────────────────────────────────────────────────────
// Panel Kaprodi
// ─────────────────────────────────────────────────────────────

async function muatPanelProdi(
  prodiId: string,
  tahunAktifId: string | null,
): Promise<DataProdi | null> {
  const prodi = await prisma.prodi.findUnique({
    where: { id: prodiId },
    select: { id: true, kode: true, nama: true },
  });
  if (!prodi) return null;

  const [kurikulum, baris, rpkps, mkAktif, usulanMenunggu, rpkpsMenunggu, kelasBelumDitutup] =
    await Promise.all([
      muatKonteksProdi(prodiId),
      muatBarisCapaian(prodiId),
      prisma.rpkps.findMany({
        where: {
          mataKuliah: { kurikulum: { prodiId } },
          ...(tahunAktifId ? { tahunAkademikId: tahunAktifId } : {}),
        },
        select: { status: true },
      }),
      prisma.mataKuliah.count({
        where: { kurikulum: { prodiId, status: "BERLAKU" } },
      }),
      prisma.usulanRevisi.count({
        where: { status: "DIAJUKAN", kurikulum: { prodiId } },
      }),
      prisma.rpkps.count({
        where: { status: "DIAJUKAN", mataKuliah: { kurikulum: { prodiId } } },
      }),
      prisma.kelas.count({
        where: {
          rpkps: {
            mataKuliah: { kurikulum: { prodiId } },
            ...(tahunAktifId ? { tahunAkademikId: tahunAktifId } : {}),
          },
          OR: [{ evaluasi: null }, { evaluasi: { status: { not: "DITUTUP" } } }],
        },
      }),
    ]);

  const agregasi = agregasiProdi({
    baris,
    cplProdi: kurikulum?.cpl.map((c) => c.kode) ?? [],
    jumlahMkKurikulum: kurikulum?._count.mataKuliah ?? 0,
    ambangKetercapaian: AMBANG_PRODI,
  });

  const deskripsi = new Map((kurikulum?.cpl ?? []).map((c) => [c.kode, c.deskripsi]));

  // Sumbu tahun akademik diurutkan menurut tahun mulai, bukan menurut abjad
  // kodenya — "2025/2026-GENAP" mendahului "2026/2027-GANJIL".
  const titikTren = [...agregasi.tren.values()].flat();
  const trenLabel = [
    ...new Map(titikTren.map((t) => [t.tahunAkademik, t.tahunMulai])).entries(),
  ]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([kode]) => kode);

  const tren = agregasi.cpl
    .filter((c) => c.kelasTerukur > 0)
    .slice(0, 5)
    .map((c) => {
      const titik = new Map(
        (agregasi.tren.get(c.kode) ?? []).map((t) => [t.tahunAkademik, t.persenLulus]),
      );
      return {
        kode: c.kode,
        titik: trenLabel.map((t) => titik.get(t) ?? null),
      };
    });

  return {
    prodi,
    kurikulum: kurikulum ? { nama: kurikulum.nama, tahun: kurikulum.tahun } : null,
    corong: sebaranStatus(
      rpkps.map((r) => r.status),
      SEGMEN_RPKPS,
    ),
    mkTanpaRpkps: Math.max(0, mkAktif - rpkps.length),
    jumlahMk: mkAktif,
    cakupanPersen: agregasi.ringkasan.cakupanPersen,
    cplTerukur: agregasi.ringkasan.cplTerukur,
    cplDibebankan: agregasi.ringkasan.cplDibebankan,
    cpl: agregasi.cpl.map((c) => ({
      kode: c.kode,
      deskripsi: deskripsi.get(c.kode) ?? "",
      persenLulus: c.persenLulus,
      kelasTerukur: c.kelasTerukur,
    })),
    trenLabel,
    tren,
    sebaran: agregasi.sebaran.slice(0, 3),
    usulanMenunggu,
    rpkpsMenunggu,
    kelasBelumDitutup,
  };
}

// ─────────────────────────────────────────────────────────────
// Panel Penjaminan Mutu
// ─────────────────────────────────────────────────────────────

async function muatPanelMutu(
  cakupan: string[] | null,
  tahunAktifId: string | null,
): Promise<DataMutu> {
  const daftarProdi = await prisma.prodi.findMany({
    where: cakupan === null ? { aktif: true } : { id: { in: cakupan } },
    orderBy: { kode: "asc" },
    select: { id: true, kode: true, nama: true },
  });

  const baris = await Promise.all(
    daftarProdi.map(async (p): Promise<BarisMutu> => {
      const [kurikulum, capaian, rpkps] = await Promise.all([
        muatKonteksProdi(p.id),
        muatBarisCapaian(p.id),
        prisma.rpkps.groupBy({
          by: ["status"],
          where: {
            mataKuliah: { kurikulum: { prodiId: p.id } },
            ...(tahunAktifId ? { tahunAkademikId: tahunAktifId } : {}),
          },
          _count: { _all: true },
        }),
      ]);

      const agregasi = agregasiProdi({
        baris: capaian,
        cplProdi: kurikulum?.cpl.map((c) => c.kode) ?? [],
        jumlahMkKurikulum: kurikulum?._count.mataKuliah ?? 0,
        ambangKetercapaian: AMBANG_PRODI,
      });

      const total = rpkps.reduce((t, r) => t + r._count._all, 0);

      return {
        prodi: p,
        rpkpsTerbit: rpkps.find((r) => r.status === "TERBIT")?._count._all ?? 0,
        rpkpsTotal: total,
        cakupanEvaluasi: agregasi.ringkasan.cakupanPersen,
        cplTercapai: agregasi.cpl.filter(
          (c) => c.persenLulus !== null && c.persenLulus >= AMBANG_PRODI,
        ).length,
        cplDibebankan: agregasi.ringkasan.cplDibebankan,
      };
    }),
  );

  const idProdi = daftarProdi.map((p) => p.id);

  const [mkSeluruh, kelasDitutup, temuanKelompok, temuanTerbuka] = await Promise.all([
    prisma.mataKuliah.count({
      where: { kurikulum: { prodiId: { in: idProdi }, status: "BERLAKU" } },
    }),
    prisma.kelas.findMany({
      where: {
        evaluasi: { status: "DITUTUP" },
        rpkps: { mataKuliah: { kurikulum: { prodiId: { in: idProdi } } } },
      },
      select: { rpkps: { select: { mataKuliahId: true } } },
    }),
    prisma.temuanEvaluasi.groupBy({
      by: ["statusVerifikasi"],
      where: {
        evaluasi: {
          kelas: { rpkps: { mataKuliah: { kurikulum: { prodiId: { in: idProdi } } } } },
        },
      },
      _count: { _all: true },
    }),
    prisma.temuanEvaluasi.findMany({
      where: {
        statusVerifikasi: "BELUM",
        evaluasi: {
          kelas: { rpkps: { mataKuliah: { kurikulum: { prodiId: { in: idProdi } } } } },
        },
      },
      orderBy: { dibuatPada: "desc" },
      take: BATAS,
      select: {
        id: true,
        kode: true,
        tingkat: true,
        tindakan: true,
        penanggungJawab: { select: { nama: true } },
        evaluasi: {
          select: {
            kelas: {
              select: { kode: true, rpkps: { select: { mataKuliah: { select: { kode: true } } } } },
            },
          },
        },
      },
    }),
  ]);

  const mkDievaluasi = new Set(kelasDitutup.map((k) => k.rpkps.mataKuliahId)).size;

  const hitungTemuan = (s: string) =>
    temuanKelompok.find((t) => t.statusVerifikasi === s)?._count._all ?? 0;

  return {
    baris,
    cakupanInstitusi: persen(mkDievaluasi, mkSeluruh),
    mkDievaluasi,
    mkSeluruh,
    temuan: {
      belum: hitungTemuan("BELUM"),
      tercapai: hitungTemuan("TERCAPAI"),
      tidakTercapai: hitungTemuan("TIDAK_TERCAPAI"),
    },
    temuanTerbuka: temuanTerbuka.map((t) => ({
      id: t.id,
      kode: t.kode,
      tingkat: t.tingkat,
      mk: t.evaluasi.kelas.rpkps.mataKuliah.kode,
      kelas: t.evaluasi.kelas.kode,
      tindakan: t.tindakan,
      penanggungJawab: t.penanggungJawab?.nama ?? null,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Panel Dosen / Koordinator MK
// ─────────────────────────────────────────────────────────────

async function muatPanelDosen(sesi: PenggunaSesi): Promise<DataDosen> {
  const daftar = await prisma.rpkps.findMany({
    where: {
      OR: [
        { pengampu: { some: { penggunaId: sesi.id } } },
        { kelas: { some: { dosenId: sesi.id } } },
      ],
    },
    orderBy: [{ diubahPada: "desc" }],
    take: BATAS,
    select: {
      id: true,
      status: true,
      tahunAkademik: { select: { kode: true } },
      mataKuliah: {
        select: {
          kode: true,
          nama: true,
          cpl: { select: { cpl: { select: { kode: true } } } },
          cpmk: {
            select: {
              kode: true,
              cpl: { select: { cpl: { select: { kode: true } } } },
              subCpmk: { select: { id: true, kode: true } },
            },
          },
        },
      },
      pengampu: { select: { penggunaId: true, peran: true } },
      komponenNilai: { select: { id: true, nama: true, bobot: true } },
      pertemuan: {
        select: {
          minggu: true,
          jenis: true,
          topik: true,
          penilaianJenis: true,
          bobot: true,
          komponenNilaiId: true,
          subCpmk: { select: { subCpmkId: true, subCpmk: { select: { kode: true } } } },
        },
      },
      tugas: {
        select: {
          nomor: true,
          nama: true,
          bobot: true,
          komponenNilaiId: true,
          mingguMulai: true,
          mingguSelesai: true,
          subCpmk: { select: { subCpmk: { select: { kode: true } } } },
        },
      },
      kisiKisi: {
        select: {
          jenis: true,
          butir: { select: { skor: true, subCpmk: { select: { kode: true } } } },
        },
      },
      _count: { select: { pustaka: true, tugas: true } },
      kelas: {
        orderBy: { kode: "asc" },
        select: {
          id: true,
          kode: true,
          _count: { select: { peserta: true } },
          evaluasi: { select: { status: true } },
        },
      },
    },
  });

  // Satu kueri untuk seluruh kelas: baris nilai dihitung per peserta lalu
  // dijumlahkan per kelas, bukan satu kueri per kelas.
  const idKelas = daftar.flatMap((r) => r.kelas.map((k) => k.id));
  const peserta =
    idKelas.length > 0
      ? await prisma.pesertaKelas.findMany({
          where: { kelasId: { in: idKelas } },
          select: { kelasId: true, _count: { select: { nilai: true } } },
        })
      : [];

  const nilaiPerKelas = new Map<string, number>();
  for (const p of peserta) {
    nilaiPerKelas.set(p.kelasId, (nilaiPerKelas.get(p.kelasId) ?? 0) + p._count.nilai);
  }

  const rpkps: BarisRpkpsDosen[] = [];
  const kelas: BarisKelasDosen[] = [];

  for (const r of daftar) {
    const subCpmkSeluruh = r.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => s.id));
    const terjadwal = new Set(
      r.pertemuan.flatMap((p) => p.subCpmk.map((s) => s.subCpmkId)),
    );

    rpkps.push({
      id: r.id,
      kode: r.mataKuliah.kode,
      nama: r.mataKuliah.nama,
      tahunAkademik: r.tahunAkademik.kode,
      status: r.status,
      koordinator: r.pengampu.some(
        (p) => p.penggunaId === sesi.id && p.peran === "KOORDINATOR",
      ),
      kelengkapan: kelengkapanRpkps({
        pertemuanTotal: r.pertemuan.length,
        pertemuanBerisi: r.pertemuan.filter((p) => (p.topik ?? "").trim() !== "").length,
        totalBobot: r.komponenNilai.reduce((t, k) => t + Number(k.bobot), 0),
        subCpmkTotal: subCpmkSeluruh.length,
        subCpmkTerjadwal: subCpmkSeluruh.filter((id) => terjadwal.has(id)).length,
        adaPustaka: r._count.pustaka > 0,
        adaTugas: r._count.tugas > 0,
      }),
    });

    // Peta asesmen disusun SEKALI per RPKPS, bukan per kelas: kelas paralel
    // berbagi satu rencana, dan hanya nilainya yang berbeda.
    const jumlahAsesmen = susunPetaAsesmen(keSumberPeta(r)).asesmen.length;

    for (const k of r.kelas) {
      kelas.push({
        id: k.id,
        rpkpsId: r.id,
        kode: k.kode,
        mk: r.mataKuliah.kode,
        tahunAkademik: r.tahunAkademik.kode,
        jumlahPeserta: k._count.peserta,
        tahap: tahapKelas({
          jumlahPeserta: k._count.peserta,
          jumlahAsesmen,
          nilaiTerisi: nilaiPerKelas.get(k.id) ?? 0,
          statusEvaluasi: k.evaluasi?.status ?? null,
        }),
      });
    }
  }

  const [temuan, usulan] = await Promise.all([
    prisma.temuanEvaluasi.findMany({
      where: { penanggungJawabId: sesi.id, statusVerifikasi: "BELUM" },
      orderBy: { dibuatPada: "desc" },
      take: BATAS,
      select: {
        id: true,
        kode: true,
        tingkat: true,
        tindakan: true,
        taSasaran: { select: { kode: true } },
        evaluasi: {
          select: {
            kelas: {
              select: { rpkps: { select: { mataKuliah: { select: { kode: true } } } } },
            },
          },
        },
      },
    }),
    prisma.usulanRevisi.findMany({
      where: { diajukanOlehId: sesi.id, status: { notIn: ["DITERAPKAN", "DITARIK"] } },
      orderBy: { diubahPada: "desc" },
      take: BATAS,
      select: {
        id: true,
        judul: true,
        status: true,
        mataKuliah: { select: { kode: true } },
      },
    }),
  ]);

  kelas.sort((a, b) => a.tahap.urutan - b.tahap.urutan || a.mk.localeCompare(b.mk));

  return {
    rpkps,
    kelas,
    temuan: temuan.map((t) => ({
      id: t.id,
      kode: t.kode,
      tingkat: t.tingkat,
      mk: t.evaluasi.kelas.rpkps.mataKuliah.kode,
      tindakan: t.tindakan,
      taSasaran: t.taSasaran?.kode ?? null,
    })),
    usulan: usulan.map((u) => ({
      id: u.id,
      judul: u.judul,
      status: u.status,
      mk: u.mataKuliah.kode,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Panel Admin
// ─────────────────────────────────────────────────────────────

async function muatPanelAdmin(): Promise<DataAdmin> {
  const sejak = new Date();
  sejak.setDate(sejak.getDate() - (HARI_DENYUT - 1));
  sejak.setHours(0, 0, 0, 0);

  const [
    jumlahProdi,
    jumlahPengguna,
    menungguVerifikasi,
    jumlahTahun,
    peran,
    kurikulum,
    log,
    prodiAktif,
    kaprodi,
  ] = await Promise.all([
    prisma.prodi.count({ where: { aktif: true } }),
    prisma.pengguna.count(),
    prisma.pengguna.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
    prisma.tahunAkademik.count(),
    prisma.penugasanPeran.groupBy({ by: ["peran"], _count: { _all: true } }),
    prisma.kurikulum.findMany({ select: { status: true } }),
    prisma.logAudit.findMany({
      where: { dibuatPada: { gte: sejak } },
      select: { dibuatPada: true },
    }),
    prisma.prodi.findMany({
      where: { aktif: true },
      select: { id: true, kode: true },
    }),
    prisma.penugasanPeran.findMany({
      where: { peran: "KAPRODI" },
      select: { prodiId: true },
    }),
  ]);

  const berkaprodi = new Set(kaprodi.map((k) => k.prodiId));

  return {
    jumlahProdi,
    jumlahPengguna,
    menungguVerifikasi,
    jumlahTahun,
    sebaranPeran: peran
      .map((p) => ({ peran: p.peran as string, jumlah: p._count._all }))
      .sort((a, b) => b.jumlah - a.jumlah),
    statusKurikulum: sebaranStatus(
      kurikulum.map((k) => k.status),
      SEGMEN_KURIKULUM,
    ),
    denyut: denyutHarian(
      log.map((l) => l.dibuatPada),
      HARI_DENYUT,
      new Date(),
    ),
    prodiTanpaKaprodi: prodiAktif.filter((p) => !berkaprodi.has(p.id)).map((p) => p.kode),
  };
}

// ─────────────────────────────────────────────────────────────
// Panel Asesor & Mahasiswa
// ─────────────────────────────────────────────────────────────

async function muatPanelAsesor(cakupan: string[] | null): Promise<DataAsesor> {
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const [rpkpsTerbit, snapshotRpkps, evaluasiDitutup, snapshotEvaluasi, daftarProdi] =
    await Promise.all([
      prisma.rpkps.count({
        where: { status: "TERBIT", mataKuliah: { kurikulum: filterProdi } },
      }),
      prisma.rpkpsSnapshot.count({
        where: { rpkps: { mataKuliah: { kurikulum: filterProdi } } },
      }),
      prisma.evaluasiMk.count({
        where: {
          status: "DITUTUP",
          kelas: { rpkps: { mataKuliah: { kurikulum: filterProdi } } },
        },
      }),
      prisma.evaluasiSnapshot.count({
        where: {
          evaluasi: { kelas: { rpkps: { mataKuliah: { kurikulum: filterProdi } } } },
        },
      }),
      prisma.prodi.findMany({
        where: cakupan === null ? { aktif: true } : { id: { in: cakupan } },
        orderBy: { kode: "asc" },
        select: { id: true, kode: true, nama: true },
      }),
    ]);

  const terbitPerProdi = await Promise.all(
    daftarProdi.map((p) =>
      prisma.rpkps.count({
        where: { status: "TERBIT", mataKuliah: { kurikulum: { prodiId: p.id } } },
      }),
    ),
  );

  return {
    rpkpsTerbit,
    snapshotRpkps,
    evaluasiDitutup,
    snapshotEvaluasi,
    prodi: daftarProdi.map((p, i) => ({
      kode: p.kode,
      nama: p.nama,
      terbit: terbitPerProdi[i],
    })),
  };
}

async function muatPanelMahasiswa(sesi: PenggunaSesi): Promise<DataMahasiswa> {
  const penugasan = sesi.penugasan.find((p) => p.peran === "MAHASISWA" && p.prodiId);
  if (!penugasan?.prodiId) return { prodi: null, terbit: 0 };

  const [prodi, terbit] = await Promise.all([
    prisma.prodi.findUnique({
      where: { id: penugasan.prodiId },
      select: { kode: true, nama: true },
    }),
    prisma.rpkps.count({
      where: {
        status: "TERBIT",
        mataKuliah: { kurikulum: { prodiId: penugasan.prodiId } },
      },
    }),
  ]);

  return { prodi, terbit };
}
