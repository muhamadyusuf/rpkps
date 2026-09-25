import type { Peran } from "@/generated/prisma";
import type { FaktaPegawai } from "./kontrak";

/**
 * Peran RPKPS yang DITURUNKAN dari identitas-itts (docs/26) — murni.
 *
 * Yang dipetakan: jabatan (lewat pemetaan peran aplikasi di identitas-itts,
 * `namaPeran` berawalan `rpkps:`) dan jenis pegawai. Yang TIDAK: KOORDINATOR_MK
 * (penetapan per mata kuliah, tetap milik RPKPS), ASESOR, MAHASISWA.
 *
 * Aturan yang tidak boleh dilonggarkan: di RPKPS `prodiId = null` berarti
 * CAKUPAN INSTITUSI. Karena itu peran yang butuh prodi (KAPRODI, DOSEN) TANPA
 * prodi yang dapat dipastikan TIDAK diberikan sama sekali — bukan diberikan
 * dengan `null`. `DOSEN` termasuk `PERAN_PENGUSUL`; DOSEN ber-`null` akan
 * dapat mengusulkan revisi kurikulum di SEMUA prodi.
 */

export const NAMA_PERAN_IDENTITAS = {
  admin: "rpkps:admin",
  gpm: "rpkps:gpm",
  kaprodi: "rpkps:kaprodi",
} as const;

/** Peran yang dikelola sinkron. Peran lain tak pernah disentuh sinkron. */
export const PERAN_TURUNAN: readonly Peran[] = ["ADMIN", "KAPRODI", "GPM", "DOSEN"];

/** unitId identitas-itts (jenis PRODI) → prodiId RPKPS. */
export type PetaProdi = ReadonlyMap<string, string>;

export type Penugasan = { peran: Peran; prodiId: string | null };

export type AlasanDiabaikan =
  | "peran-tak-dikenal"
  | "jabatan-tak-ada"
  | "unit-bukan-prodi"
  | "prodi-belum-dipetakan"
  | "homebase-kosong"
  | "homebase-belum-dipetakan";

/** `unitId` ada bila sebabnya unit yang belum dipetakan — bahan laporan "petakan unit ini ke prodi mana". */
export type Diabaikan = { sumber: string; alasan: AlasanDiabaikan; unitId?: string };

export type Turunan = { penugasan: Penugasan[]; diabaikan: Diabaikan[] };

export const kunciPenugasan = (p: Penugasan): string => `${p.peran}|${p.prodiId ?? ""}`;

/**
 * Peran seseorang menurut identitas-itts. Pegawai nonaktif tidak membawa
 * peran apa pun. Hasil terurut dan tanpa duplikat, supaya perbandingan
 * dan pengujian deterministik.
 */
export function turunkanPeran(fakta: Pick<FaktaPegawai, "aktif" | "jenisPegawai" | "homebaseUnitId" | "peran">, peta: PetaProdi): Turunan {
  const penugasan = new Map<string, Penugasan>();
  const diabaikan: Diabaikan[] = [];
  const tambah = (p: Penugasan) => penugasan.set(kunciPenugasan(p), p);

  if (!fakta.aktif) return { penugasan: [], diabaikan: [] };

  for (const p of fakta.peran) {
    switch (p.namaPeran.trim().toLowerCase()) {
      case NAMA_PERAN_IDENTITAS.admin:
        tambah({ peran: "ADMIN", prodiId: null });
        break;
      case NAMA_PERAN_IDENTITAS.gpm:
        tambah({ peran: "GPM", prodiId: null });
        break;
      case NAMA_PERAN_IDENTITAS.kaprodi: {
        if (!p.jabatan) {
          diabaikan.push({ sumber: p.namaPeran, alasan: "jabatan-tak-ada" });
          break;
        }
        if (p.jabatan.unit.jenis !== "PRODI") {
          diabaikan.push({ sumber: p.namaPeran, alasan: "unit-bukan-prodi" });
          break;
        }
        const prodiId = peta.get(p.jabatan.unit.id);
        if (!prodiId) diabaikan.push({ sumber: p.namaPeran, alasan: "prodi-belum-dipetakan", unitId: p.jabatan.unit.id });
        else tambah({ peran: "KAPRODI", prodiId });
        break;
      }
      default:
        diabaikan.push({ sumber: p.namaPeran, alasan: "peran-tak-dikenal" });
    }
  }

  if (fakta.jenisPegawai === "DOSEN") {
    if (!fakta.homebaseUnitId) {
      diabaikan.push({ sumber: "jenisPegawai=DOSEN", alasan: "homebase-kosong" });
    } else {
      const prodiId = peta.get(fakta.homebaseUnitId);
      if (!prodiId) diabaikan.push({ sumber: "jenisPegawai=DOSEN", alasan: "homebase-belum-dipetakan", unitId: fakta.homebaseUnitId });
      else tambah({ peran: "DOSEN", prodiId });
    }
  }

  return {
    penugasan: [...penugasan.values()].sort((a, b) => kunciPenugasan(a).localeCompare(kunciPenugasan(b))),
    diabaikan,
  };
}

// ─── Rekonsiliasi ──────────────────────────────────────────────────────────

export type PenugasanAda = { id: string; peran: Peran; prodiId: string | null; sumber: "LOKAL" | "IDENTITAS" };

export type RencanaRekonsiliasi = {
  /** Belum ada sama sekali → dibuat dengan sumber IDENTITAS. */
  tambah: Penugasan[];
  /** Sudah ada sebagai LOKAL padahal identitas-itts juga menghendakinya → diubah menjadi IDENTITAS. */
  promosi: string[];
  /** Sumber IDENTITAS yang tidak lagi dikehendaki → dihapus. */
  hapus: string[];
  /** LOKAL (peran turunan) yang identitas-itts TIDAK dukung. Dilaporkan; dihapus hanya bila `hapusLokal`. */
  lokalTakDidukung: PenugasanAda[];
};

/**
 * Rencana perubahan agar baris `penugasan_peran` seorang pegawai sama dengan
 * yang dikehendaki identitas-itts. Tidak menyentuh apa pun — hanya menghitung.
 *
 * Peran LOKAL di luar {@link PERAN_TURUNAN} (KOORDINATOR_MK, ASESOR, MAHASISWA)
 * tidak dianggap sama sekali. Peran LOKAL turunan yang tak didukung identitas-itts
 * TIDAK dihapus secara bawaan: itu keadaan peralihan yang sah (admin belum
 * memetakan jabatan di sana) dan menghapusnya diam-diam mengunci orang. Penghapusan
 * hanya bila `hapusLokal`, dan `lindungi` mengecualikan baris tertentu (admin bootstrap).
 */
export function rekonsiliasi(
  diinginkan: readonly Penugasan[],
  ada: readonly PenugasanAda[],
  opsi: { hapusLokal: boolean; lindungi?: (p: PenugasanAda) => boolean },
): RencanaRekonsiliasi {
  const dikehendaki = new Set(diinginkan.map(kunciPenugasan));
  const turunan = ada.filter((a) => PERAN_TURUNAN.includes(a.peran));
  const adaKunci = new Map(turunan.map((a) => [kunciPenugasan(a), a] as const));

  const tambah = diinginkan.filter((d) => !adaKunci.has(kunciPenugasan(d)));
  const promosi = diinginkan.flatMap((d) => {
    const a = adaKunci.get(kunciPenugasan(d));
    return a && a.sumber === "LOKAL" ? [a.id] : [];
  });

  const hapus: string[] = [];
  const lokalTakDidukung: PenugasanAda[] = [];
  for (const a of turunan) {
    if (dikehendaki.has(kunciPenugasan(a))) continue;
    if (a.sumber === "IDENTITAS") {
      hapus.push(a.id);
    } else {
      lokalTakDidukung.push(a);
      if (opsi.hapusLokal && !opsi.lindungi?.(a)) hapus.push(a.id);
    }
  }
  return { tambah, promosi, hapus, lokalTakDidukung };
}

/**
 * Pagar penghapusan massal untuk sinkron menyeluruh: identitas-itts yang keliru
 * (pemetaan peran terhapus, jabatan dikosongkan tak sengaja, jawaban kosong) tidak
 * boleh diterjemahkan menjadi pencabutan peran serentak. Batasnya 25% dari
 * peran turunan yang ada, dengan lantai 5 supaya instalasi kecil tetap dapat bergerak.
 */
export function pagarPenghapusan(totalAda: number, akanHapus: number): { ok: boolean; batas: number } {
  const batas = Math.max(5, Math.floor(totalAda * 0.25));
  return { ok: akanHapus <= batas, batas };
}

// ─── Status pengguna setelah sinkron ───────────────────────────────────────

export type StatusPenggunaLokal = "AKTIF" | "NONAKTIF" | "MENUNGGU_VERIFIKASI";

/**
 * Status baru bagi seorang pegawai setelah sinkron, atau `null` bila tak berubah.
 *
 *   - Nonaktif di identitas-itts → NONAKTIF.
 *   - MENUNGGU_VERIFIKASI → AKTIF begitu ia punya paling sedikit satu peran
 *     (dari sumber mana pun): "menunggu verifikasi" dulu berarti menunggu admin
 *     menetapkan peran, dan peran kini datang sendiri dari jabatan.
 *   - NONAKTIF TIDAK PERNAH diaktifkan kembali oleh sinkron. Sinkron tak dapat
 *     membedakan penonaktifan oleh admin RPKPS dari penonaktifan akibat
 *     identitas-itts; menghidupkannya diam-diam membuka kembali akses yang
 *     sengaja ditutup. Mengaktifkan kembali = tindakan admin di /pengguna.
 */
export function statusSetelahSinkron(
  sekarang: StatusPenggunaLokal,
  pegawaiAktif: boolean,
  jumlahPeranSetelah: number,
): StatusPenggunaLokal | null {
  if (!pegawaiAktif) return sekarang === "NONAKTIF" ? null : "NONAKTIF";
  if (sekarang === "MENUNGGU_VERIFIKASI" && jumlahPeranSetelah > 0) return "AKTIF";
  return null;
}

// ─── Gerbang untuk pengguna non-pegawai ────────────────────────────────────

/** Peran yang sah dipegang orang di luar identitas-itts. */
export const PERAN_NON_PEGAWAI: readonly Peran[] = ["ASESOR", "MAHASISWA"];

/**
 * Pengguna LOKAL — bukan pegawai — boleh masuk tanpa lolos gerbang kepegawaian
 * bila SELURUH ciri ini terpenuhi: tak bertaut ke identitas-itts, AKTIF, dan
 * seluruh perannya (minimal satu) hanya ASESOR/MAHASISWA.
 *
 * Ciri terakhir yang membedakan asesor eksternal dari pegawai lama yang barisnya
 * belum ditautkan: pegawai lama itu memegang DOSEN/KAPRODI/GPM/ADMIN, jadi tetap
 * wajib lolos gerbang — kalau tidak, tidak ada bedanya mendaftar di sini dan
 * tidak di identitas-itts, dan gerbang kepegawaian kehilangan arti.
 */
export function bolehLewatGerbangLokal(p: {
  identitasAkunId: string | null;
  status: StatusPenggunaLokal;
  peran: readonly Peran[];
}): boolean {
  if (p.identitasAkunId !== null || p.status !== "AKTIF" || p.peran.length === 0) return false;
  return p.peran.every((r) => PERAN_NON_PEGAWAI.includes(r));
}

/**
 * Peran yang boleh ditambahkan admin sebagai baris LOKAL. Pegawai (bertaut ke identitas-itts)
 * boleh diberi peran lokal apa pun — mis. KOORDINATOR_MK, yang memang penetapan RPKPS. Pengguna
 * LOKAL hanya boleh ASESOR/MAHASISWA: peran lain membuat {@link bolehLewatGerbangLokal} salah,
 * jadi orangnya tak dapat masuk sama sekali, dan itu keadaan yang lebih baik dicegah daripada dijelaskan.
 */
export function peranLokalBoleh(bertaut: boolean, peran: Peran): boolean {
  return bertaut || PERAN_NON_PEGAWAI.includes(peran);
}
