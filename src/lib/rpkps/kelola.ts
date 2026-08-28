import "server-only";
import { prisma } from "@/lib/prisma";
import { cakupanProdi } from "@/lib/otorisasi";
import { periksaKelayakanHapus } from "@/domain/rpkps/daur-hidup";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
import type { PenggunaSesi } from "@/lib/sesi";

/**
 * Data pendukung panel pengelolaan RPKPS (docs/06): calon pengampu, sasaran
 * salin, dan sensus penghalang penghapusan.
 *
 * Hanya dipanggil untuk pengguna yang memang boleh mengelola — daftar seluruh
 * dosen dan seluruh mata kuliah bukan sesuatu yang perlu ikut terkirim ke
 * peramban setiap kali halaman detail dibuka.
 */

export type DataKelola = {
  calon: { id: string; nama: string; prodi: string | null }[];
  sasaran: {
    id: string;
    kode: string;
    nama: string;
    semester: number;
    taTerpakai: string[];
  }[];
  tahun: { id: string; kode: string }[];
  /** Kosong berarti RPKPS memenuhi syarat penghapusan. */
  alasanTakDapatDihapus: string[];
};

const PERAN_DOSEN = ["DOSEN", "KOORDINATOR_MK", "KAPRODI"] as const;

export async function muatDataKelola(
  sesi: PenggunaSesi,
  rpkpsId: string,
): Promise<DataKelola> {
  const cakupan = cakupanProdi(sesi);
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const [calonMentah, mk, tahun, sensus] = await Promise.all([
    /**
     * Calon pengampu TIDAK disaring per prodi: sejak docs/06 §3.4 kepengampuan
     * adalah jalur akses tersendiri, dan team teaching lintas prodi memang
     * terjadi. Prodi tetap ditampilkan di label supaya pemilihan tidak
     * kehilangan konteks.
     */
    prisma.pengguna.findMany({
      where: {
        status: "AKTIF",
        penugasan: { some: { peran: { in: [...PERAN_DOSEN] } } },
      },
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        gelarDepan: true,
        gelarBelakang: true,
        penugasan: { select: { prodi: { select: { kode: true } } } },
      },
    }),
    prisma.mataKuliah.findMany({
      where: { kurikulum: { status: "BERLAKU", ...filterProdi }, cpmk: { some: {} } },
      orderBy: [{ semester: "asc" }, { kode: "asc" }],
      select: {
        id: true,
        kode: true,
        nama: true,
        semester: true,
        rpkps: { select: { tahunAkademikId: true } },
      },
    }),
    prisma.tahunAkademik.findMany({
      orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
      select: { id: true, kode: true },
    }),
    prisma.rpkps.findUnique({
      where: { id: rpkpsId },
      select: {
        status: true,
        _count: { select: { snapshot: true } },
        kelas: {
          select: {
            kode: true,
            evaluasi: { select: { id: true } },
            peserta: { select: { _count: { select: { nilai: true } } } },
          },
        },
      },
    }),
  ]);

  const kelayakan = sensus
    ? periksaKelayakanHapus({
        status: sensus.status,
        jumlahSnapshot: sensus._count.snapshot,
        kelas: sensus.kelas.map((k) => ({
          kode: k.kode,
          jumlahPeserta: k.peserta.length,
          jumlahNilai: k.peserta.reduce((n, p) => n + p._count.nilai, 0),
          adaEvaluasi: k.evaluasi !== null,
        })),
      })
    : { boleh: false, alasan: ["RPKPS tidak ditemukan."] };

  return {
    calon: calonMentah.map((c) => ({
      id: c.id,
      nama: namaLengkapPengampu(c),
      prodi:
        [...new Set(c.penugasan.map((p) => p.prodi?.kode).filter(Boolean))].join("/") || null,
    })),
    sasaran: mk.map((m) => ({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
      semester: m.semester,
      taTerpakai: m.rpkps.map((r) => r.tahunAkademikId),
    })),
    tahun,
    alasanTakDapatDihapus: kelayakan.alasan,
  };
}
