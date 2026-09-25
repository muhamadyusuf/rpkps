import "server-only";
import { prisma } from "@/lib/prisma";
import { adalahAdmin, cakupanProdi } from "@/lib/otorisasi";
import { periksaKelayakanHapus, ringkasAkibatHapus } from "@/domain/rpkps/daur-hidup";
import { PILIH_RUJUKAN_PENGGUNA } from "@/domain/identitas/tampilan";
import { tampilanDariRujukan } from "@/lib/pengguna/tampilan";
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
    namaEn: string | null;
    semester: number;
    taTerpakai: string[];
  }[];
  tahun: { id: string; kode: string }[];
  /**
   * Tautan pratinjau dokumen ini (docs/06 §4.2), terbaru dulu. Yang DICABUT
   * dan yang KEDALUWARSA ikut terbawa: daftar yang hanya menampilkan tautan
   * hidup menyembunyikan justru pertanyaan yang paling sering muncul — "tautan
   * yang saya kirim bulan lalu itu masih terbuka atau tidak?".
   */
  tautan: {
    id: string;
    token: string;
    catatan: string | null;
    kedaluwarsa: Date;
    dicabutPada: Date | null;
    jumlahAkses: number;
    terakhirAkses: Date | null;
  }[];
  /** Kosong berarti RPKPS memenuhi syarat penghapusan. */
  alasanTakDapatDihapus: string[];
  /**
   * Apa yang lenyap bila penghapusan tetap dipaksakan (docs/06 §2.6) — dihitung
   * dari sensus yang sama, bukan dikarang di dialog.
   */
  akibatHapusPaksa: string[];
  /** Hanya ADMIN yang ditawari jalur paksa; selain itu tombolnya tidak ada. */
  bolehHapusPaksa: boolean;
};

const PERAN_DOSEN = ["DOSEN", "KOORDINATOR_MK", "KAPRODI"] as const;

export async function muatDataKelola(
  sesi: PenggunaSesi,
  rpkpsId: string,
): Promise<DataKelola> {
  const cakupan = cakupanProdi(sesi);
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const [calonMentah, mk, tahun, sensus, tautan] = await Promise.all([
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
      // Diurutkan menurut nama SETELAH dibaca dari identitas-itts (di bawah): kolom nama di sini bukan sumbernya.
      select: {
        ...PILIH_RUJUKAN_PENGGUNA,
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
        namaEn: true,
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
    prisma.tautanBerbagi.findMany({
      where: { rpkpsId },
      orderBy: { dibuatPada: "desc" },
      select: {
        id: true,
        token: true,
        catatan: true,
        kedaluwarsa: true,
        dicabutPada: true,
        jumlahAkses: true,
        terakhirAkses: true,
      },
    }),
  ]);

  const ringkasSensus = sensus
    ? {
        status: sensus.status,
        jumlahSnapshot: sensus._count.snapshot,
        kelas: sensus.kelas.map((k) => ({
          kode: k.kode,
          jumlahPeserta: k.peserta.length,
          jumlahNilai: k.peserta.reduce((n, p) => n + p._count.nilai, 0),
          adaEvaluasi: k.evaluasi !== null,
        })),
      }
    : null;

  const kelayakan = ringkasSensus
    ? periksaKelayakanHapus(ringkasSensus)
    : { boleh: false, alasan: ["RPKPS tidak ditemukan."] };

  const akibat = ringkasSensus ? ringkasAkibatHapus(ringkasSensus).rincian : [];

  // Satu panggilan ke identitas-itts untuk SELURUH calon, bukan satu per calon.
  const tampilan = await tampilanDariRujukan(calonMentah);
  const calon = calonMentah
    .map((c) => {
      const t = tampilan.get(c.id);
      return {
        id: c.id,
        urut: t?.nama ?? c.email,
        nama: t?.namaLengkap ?? c.email,
        prodi:
          [...new Set(c.penugasan.map((p) => p.prodi?.kode).filter(Boolean))].join("/") || null,
      };
    })
    .sort((a, b) => a.urut.localeCompare(b.urut, "id"))
    .map(({ id, nama, prodi }) => ({ id, nama, prodi }));

  return {
    calon,
    sasaran: mk.map((m) => ({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
      namaEn: m.namaEn,
      semester: m.semester,
      taTerpakai: m.rpkps.map((r) => r.tahunAkademikId),
    })),
    tahun,
    tautan,
    alasanTakDapatDihapus: kelayakan.alasan,
    akibatHapusPaksa: akibat,
    bolehHapusPaksa: adalahAdmin(sesi),
  };
}
