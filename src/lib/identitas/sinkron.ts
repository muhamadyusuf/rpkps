import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { uraiHalamanDirektori, uraiPeranAplikasi, type BarisDirektori } from "@/domain/identitas/kontrak";
import { GalatIdentitas, ambilDariIdentitas } from "@/lib/identitas/klien";
import { periksaStatusKepegawaian, type FaktaLogin } from "@/lib/identitas/status";
import {
  sinkronkanFakta,
  sinkronkanSemuaInti,
  type HasilSatu,
  type LaporanSinkron,
  type OpsiSinkron,
} from "@/lib/identitas/sinkron-inti";

/**
 * Sinkron peran dari identitas-itts (docs/26 §5) — penyambung jaringan.
 * Logikanya ada di `sinkron-inti.ts` (diuji di PGlite).
 *
 * Tiga pemicu, dari yang paling cepat:
 *   1. SAAT MASUK — `sinkronkanSaatMasuk`: peran orangnya siap sebelum halaman pertama.
 *   2. MALAR — `jadwalkanSinkron` dari `sesiSaatIni`: bila sinkron terakhir lebih tua
 *      dari 15 menit, disegarkan di belakang layar (`after`) tanpa menahan halaman.
 *   3. CRON HARIAN — `sinkronkanSemua`: menyelaraskan SEMUA orang, termasuk yang tak
 *      pernah masuk lagi (peran dicabut, cangkang dosen baru dibuat).
 *
 * Kegagalan sinkron TIDAK PERNAH menggagalkan login atau halaman: peran yang ada
 * dipertahankan sampai sinkron berikutnya berhasil.
 */

/** Setelah ini, peran seseorang dianggap perlu disegarkan lagi. */
export const MASA_SEGAR_PERAN_MS = 15 * 60_000;

function opsi(): OpsiSinkron {
  return {
    // Bawaan MATI: peran LOKAL yang tak didukung identitas-itts hanya dilaporkan. Nyalakan
    // (SINKRON_HAPUS_LOKAL=1) hanya setelah laporan sinkron menunjukkan semua jabatan sudah dipetakan.
    hapusLokal: process.env.SINKRON_HAPUS_LOKAL === "1",
    emailBootstrap: env.adminBootstrapEmails,
  };
}

function pesan(g: unknown): string {
  return g instanceof Error ? `${g.name}: ${g.message}` : "galat tak dikenal";
}

/**
 * Dipanggil `selesaikanMasuk` SETELAH pengguna dibuat/ditautkan, dengan fakta dari
 * `status-pegawai` yang sudah dipegang — tanpa panggilan tambahan.
 */
export async function sinkronkanSaatMasuk(penggunaId: string, fakta: FaktaLogin): Promise<HasilSatu | null> {
  try {
    return await sinkronkanFakta(prisma, penggunaId, { ...fakta, aktif: true }, opsi());
  } catch (galat) {
    console.error("[sinkron] gagal menyelaraskan peran saat masuk:", pesan(galat));
    return null;
  }
}

/** Menyegarkan peran satu pengguna dengan menanyakan `status-pegawai`. */
export async function sinkronkanPengguna(penggunaId: string): Promise<HasilSatu | null> {
  const p = await prisma.pengguna.findUnique({ where: { id: penggunaId }, select: { email: true, identitasAkunId: true } });
  if (!p?.identitasAkunId) return null; // pengguna LOKAL: bukan urusan sinkron

  try {
    const status = await periksaStatusKepegawaian(p.email);
    if (!status.diperiksa) return null;
    if (!status.terdaftar || !status.aktif) {
      // Tak lagi pegawai aktif: peran turunannya dicabut dan statusnya NONAKTIF.
      return await sinkronkanFakta(
        prisma,
        penggunaId,
        { akunId: p.identitasAkunId, aktif: false, jenisPegawai: "", homebaseUnitId: null, peran: [] },
        opsi(),
      );
    }
    if (!status.fakta) return null; // identitas-itts versi lama: belum ada bahan penurun peran
    return await sinkronkanFakta(prisma, penggunaId, { ...status.fakta, aktif: true }, opsi());
  } catch (galat) {
    // Identitas-itts padam / kredensial: peran yang ada dipertahankan, coba lagi nanti.
    console.error("[sinkron] gagal menyegarkan peran:", pesan(galat));
    return null;
  }
}

const sedangJalan = new Set<string>();

/**
 * Menjadwalkan penyegaran peran di belakang layar bila sudah basi. Dipanggil
 * `sesiSaatIni` pada setiap permintaan, jadi HARUS murah: satu perbandingan waktu
 * dan, paling banyak sekali per 15 menit per orang, satu pekerjaan `after`.
 */
export function jadwalkanSinkron(p: { id: string; identitasAkunId: string | null; sinkronPada: Date | null }): void {
  if (!p.identitasAkunId || !env.identitasItts) return;
  if (p.sinkronPada && Date.now() - p.sinkronPada.getTime() < MASA_SEGAR_PERAN_MS) return;
  if (sedangJalan.has(p.id)) return;

  sedangJalan.add(p.id);
  const kerja = () => sinkronkanPengguna(p.id).finally(() => sedangJalan.delete(p.id));
  try {
    after(kerja);
  } catch {
    // Di luar lingkup permintaan (skrip, uji): jalankan langsung, tanpa menahan pemanggil.
    void kerja();
  }
}

async function kumpulkanDirektori(): Promise<BarisDirektori[]> {
  const semua: BarisDirektori[] = [];
  let kursor: string | null = null;
  // Batas halaman: 500 × 100 = 50.000 pegawai — lebih dari cukup, dan menghentikan kursor yang tak pernah habis.
  for (let i = 0; i < 100; i++) {
    const isi = uraiHalamanDirektori(
      await ambilDariIdentitas("/api/v1/pegawai/direktori", { aktif: "1", batas: "500", ...(kursor ? { kursor } : {}) }),
    );
    if (!isi) throw new GalatIdentitas("jawaban-cacat", "identitas-itts menjawab direktori dengan bentuk tak dikenal");
    // Baris cacat = kontrak dilanggar. Meneruskan sisanya berarti orang yang barisnya cacat dianggap "tak lagi aktif" dan dicabut.
    if (isi.cacat > 0) throw new GalatIdentitas("jawaban-cacat", `identitas-itts mengirim ${isi.cacat} baris direktori yang cacat`);
    semua.push(...isi.pegawai);
    if (!isi.berikutnya) return semua;
    kursor = isi.berikutnya;
  }
  throw new GalatIdentitas("jawaban-cacat", "direktori identitas-itts tidak pernah habis");
}

/**
 * Menyelaraskan SEMUA pegawai (cron harian dan tombol admin). Melempar bila
 * identitas-itts tak terjangkau atau jawabannya cacat — dalam kasus itu TIDAK
 * ada yang diubah, dan rute pemanggil melapor 502.
 */
export async function sinkronkanSemua(): Promise<LaporanSinkron> {
  const peranAplikasi = uraiPeranAplikasi(await ambilDariIdentitas("/api/v1/peran-aplikasi"));
  if (!peranAplikasi) throw new GalatIdentitas("jawaban-cacat", "identitas-itts menjawab peran-aplikasi dengan bentuk tak dikenal");
  const direktori = await kumpulkanDirektori();
  return sinkronkanSemuaInti(prisma, { peranAplikasi, direktori }, opsi());
}
