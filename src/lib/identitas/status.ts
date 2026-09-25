import "server-only";
import { env } from "@/lib/env";
import { uraiStatusDasar, uraiStatusPegawai, type PeranDariIdentitas } from "@/domain/identitas/kontrak";
import { GalatIdentitas, ambilDariIdentitas } from "@/lib/identitas/klien";

/**
 * Fakta yang dibawa `status-pegawai` untuk pegawai AKTIF: dengan ini saat login
 * RPKPS menautkan akun (`akunId`) dan menurunkan peran dalam SATU panggilan
 * (identitas-itts docs/07 §3). Null bila identitas-itts belum dimutakhirkan —
 * gerbang tetap bekerja, hanya penurunan peran yang menunggu sinkron berikutnya.
 */
export type FaktaLogin = {
  akunId: string;
  jenisPegawai: string;
  homebaseUnitId: string | null;
  peran: readonly PeranDariIdentitas[];
};

export type StatusKepegawaian =
  | { diperiksa: true; terdaftar: boolean; aktif: boolean; nama: string | null; fakta: FaktaLogin | null }
  | { diperiksa: false }; // integrasi belum dikonfigurasi — gerbang dilewati

/**
 * Menanyakan identitas-itts: apakah surel ini pegawai terdaftar yang aktif.
 *
 * Batas waktunya 8 detik (`BATAS_WAKTU_IDENTITAS_MS`, lib/identitas/klien.ts),
 * bukan angka bulat "aman" biasa — dalam pengembangan (Turbopack), permintaan
 * PERTAMA ke sebuah rute setelah server dinyalakan ulang dikompilasi di tempat
 * dan sudah pernah memakan ±3,7 detik dalam uji manual. Produksi tidak
 * mengalami ini; angkanya dipilih supaya gerbang gagal-tertutup tidak salah
 * menolak login gara-gara kompilasi dingin, bukan identitas-itts yang
 * benar-benar tidak terjangkau.
 *
 * GAGAL-TERTUTUP: kalau identitas-itts TIDAK DAPAT DIHUBUNGI (jaringan,
 * kedaluwarsa, jawaban tak terduga) sementara integrasinya SUDAH
 * dikonfigurasi, ini melempar — pemanggil (`selesaikanMasuk`) menolak login,
 * bukan meloloskannya. Ini pilihan sadar (bukan default framework): admin
 * institusi memilih gerbang keras di atas gagal-terbuka, supaya padamnya
 * identitas-itts tidak diam-diam berarti "kepegawaian tidak diperiksa".
 *
 * Satu-satunya jalan lewat tanpa pemeriksaan adalah TIDAK mengisi
 * IDENTITAS_ITTS_* sama sekali (`env.identitasItts` bernilai null) —
 * itu berarti integrasinya belum diaktifkan, bukan gagal.
 */
export async function periksaStatusKepegawaian(email: string): Promise<StatusKepegawaian> {
  if (!env.identitasItts) return { diperiksa: false };

  const isi = await ambilDariIdentitas("/api/v1/status-pegawai", { email });

  const dasar = uraiStatusDasar(isi);
  if (!dasar) throw new GalatIdentitas("jawaban-cacat", "identitas-itts menjawab status-pegawai dengan bentuk tak dikenal");

  // Perluasan dibaca terpisah dan TIDAK menggagalkan gerbang bila belum ada / cacat.
  const lanjut = dasar.terdaftar && dasar.aktif ? uraiStatusPegawai(isi) : null;
  const fakta: FaktaLogin | null =
    lanjut && lanjut.terdaftar && lanjut.aktif
      ? { akunId: lanjut.akunId, jenisPegawai: lanjut.jenisPegawai, homebaseUnitId: lanjut.homebaseUnitId, peran: lanjut.peran }
      : null;

  return { diperiksa: true, terdaftar: dasar.terdaftar, aktif: dasar.aktif, nama: dasar.nama, fakta };
}
