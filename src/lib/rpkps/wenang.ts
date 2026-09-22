import "server-only";
import { prisma } from "@/lib/prisma";
import { cakupanKurikulum, cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import type { PenggunaSesi } from "@/lib/sesi";
import type { PeranPengampu, StatusRpkps } from "@/generated/prisma";
import type { Kamus } from "@/kamus";

/**
 * Satu-satunya tempat wewenang atas SEBUAH RPKPS diputuskan.
 *
 * Sebelumnya aturan ini disalin di enam berkas aksi dengan bentuk
 * `dalamCakupan && (pengampu || peranPengelola)`. Konjungsi itu membuat
 * penunjukan pengampu lintas prodi tidak berarti apa-apa: dosen ditambahkan,
 * lalu ditolak halaman detail yang memeriksa cakupan prodi sendiri.
 *
 * Aturan sekarang — lihat docs/06 §3.4, keputusan K2:
 *
 *   boleh = pengampu                                   (penunjukan eksplisit)
 *         || (dalamCakupan && ADMIN|KAPRODI|GPM)       (wewenang jabatan)
 *
 * Kepengampuan adalah JALUR AKSES TERSENDIRI, bukan tambahan di atas cakupan
 * prodi: ditunjuk sebagai pengampu berarti boleh menyunting RPKPS itu, dan
 * hanya RPKPS itu. Cakupan prodi tetap mengatur usulan revisi dan agregasi
 * evaluasi prodi. Membuat RPKPS baru lintas prodi punya cakupan tersendiri di
 * `cakupanKurikulum` (docs/21).
 *
 * MEMBUKA (bolehLihat) lebih longgar lagi dan sengaja TIDAK dibatasi prodi:
 * dosen, koordinator MK, dan Kaprodi boleh membaca RPKPS prodi mana pun
 * sebagai referensi — persis cakupan yang sudah dipakai `cakupanKurikulum`
 * untuk membaca kurikulum lintas prodi. Ini murni hak BACA; menyunting tetap
 * `boleh` (pengampu atau pengelola dalam cakupan), tidak berubah.
 */

export type BarisPengampu = { penggunaId: string; peran?: PeranPengampu };

/**
 * Isi dokumen hanya boleh disunting saat rantai pengesahan BELUM berjalan.
 *
 * Aturan ini sudah berlaku sejak dulu — tetapi disalin apa adanya di tiga
 * berkas aksi (tugas, kisi-kisi, draf AI) dan sama sekali TIDAK ADA di
 * `rpkps/aksi.ts`, sehingga identitas, tabel mingguan, pustaka, dan komponen
 * nilai masih dapat diubah setelah dokumen diajukan. Selama keputusan terjadi
 * dalam hitungan menit hal itu tidak terasa; dengan rantai tiga cap yang
 * berjalan berhari-hari (docs/14 §2.3) akibatnya serius: Kaprodi
 * menandatangani dokumen A, Penjaminan Mutu mengesahkan dokumen B.
 *
 * Karena itu satu penjaga, di satu tempat — rumah yang sama dengan seluruh
 * aturan wewenang atas sebuah RPKPS.
 */
export function bolehSuntingIsi(status: StatusRpkps | null): boolean {
  return status === "DRAF" || status === "DIREVISI";
}

/** Kalimat penolakan yang menyebut alasannya, bukan sekadar "tidak boleh". */
export function pesanTerkunci(status: StatusRpkps | null, k: Kamus): string {
  switch (status) {
    case "DIAJUKAN":
      return k.aksi.terkunci.diajukan;
    case "DISETUJUI":
      return k.aksi.terkunci.disetujui;
    case "TERBIT":
      return k.aksi.terkunci.terbit;
    case "ARSIP":
      return k.aksi.terkunci.arsip;
    default:
      return k.aksi.terkunci.lainnya;
  }
}

export type SasaranWenang = {
  mataKuliah: { kurikulum: { prodiId: string } };
  pengampu: readonly BarisPengampu[];
};

export type Wenang = {
  /** Terdaftar di `rpkps_pengampu`, peran apa pun. */
  pengampu: boolean;
  /** Pengampu berperan KOORDINATOR — pemegang tanggung jawab dokumen. */
  koordinator: boolean;
  /** Prodi RPKPS ini termasuk cakupan penugasan pengguna. */
  dalamCakupan: boolean;
  /** ADMIN/KAPRODI/GPM yang cakupan prodinya memuat RPKPS ini. */
  pengelola: boolean;
  /**
   * Boleh MEMBUKA. Lebih longgar daripada `boleh`: dosen, koordinator MK, dan
   * Kaprodi boleh membaca RPKPS prodi mana pun sebagai referensi, tidak hanya
   * milik prodinya sendiri (lihat `cakupanKurikulum`).
   */
  bolehLihat: boolean;
  /** Boleh MENYUNTING RPKPS ini. */
  boleh: boolean;
};

/** Menimbang wewenang atas RPKPS yang sudah dimuat pemanggil. */
export function wenangAtasRpkps(
  sesi: PenggunaSesi | null,
  rpkps: SasaranWenang,
): Wenang {
  if (!sesi) {
    return {
      pengampu: false,
      koordinator: false,
      dalamCakupan: false,
      pengelola: false,
      bolehLihat: false,
      boleh: false,
    };
  }

  const baris = rpkps.pengampu.find((p) => p.penggunaId === sesi.id);
  const pengampu = baris !== undefined;
  const koordinator = baris?.peran === "KOORDINATOR";

  const cakupan = cakupanProdi(sesi);
  const dalamCakupan =
    cakupan === null || cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId);
  const pengelola = dalamCakupan && punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM");

  /**
   * Baca lintas prodi: dosen, koordinator MK, dan Kaprodi boleh MEMBUKA RPKPS
   * prodi mana pun (referensi silabus), sama seperti mereka sudah boleh
   * membaca kurikulum lintas prodi. `cakupanKurikulum` mengembalikan null
   * untuk peran-peran itu — lihat `src/domain/otorisasi.ts`.
   */
  const bacaLintasProdi = cakupanKurikulum(sesi) === null;

  return {
    pengampu,
    koordinator,
    dalamCakupan,
    pengelola,
    bolehLihat: dalamCakupan || pengampu || bacaLintasProdi,
    boleh: pengampu || pengelola,
  };
}

export type WenangRpkps = Wenang & {
  sesi: PenggunaSesi;
  prodiId: string | null;
  status: StatusRpkps | null;
  /** Berwenang DAN dokumennya sedang boleh disunting. */
  bolehSunting: boolean;
};

/**
 * Memuat RPKPS seperlunya lalu menimbang wewenang. Dipakai server action yang
 * hanya memegang `rpkpsId`.
 */
export async function wenangRpkps(rpkpsId: string): Promise<WenangRpkps> {
  const sesi = await wajibAktif();
  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      status: true,
      mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } },
      pengampu: { select: { penggunaId: true, peran: true } },
    },
  });

  if (!rpkps) {
    return {
      sesi,
      prodiId: null,
      status: null,
      pengampu: false,
      koordinator: false,
      dalamCakupan: false,
      pengelola: false,
      bolehLihat: false,
      boleh: false,
      bolehSunting: false,
    };
  }

  const wenang = wenangAtasRpkps(sesi, rpkps);

  return {
    sesi,
    prodiId: rpkps.mataKuliah.kurikulum.prodiId,
    status: rpkps.status,
    ...wenang,
    bolehSunting: wenang.boleh && bolehSuntingIsi(rpkps.status),
  };
}

/**
 * Penyaring daftar RPKPS. Cakupannya `cakupanKurikulum`, bukan `cakupanProdi`:
 * dosen, koordinator MK, dan Kaprodi boleh MEMBACA RPKPS prodi mana pun
 * (`bolehLihat` di atas), jadi daftarnya tidak boleh lebih sempit daripada apa
 * yang boleh mereka buka satu per satu — itu hanya membuat pilihan prodi lain
 * di saringan unit mengembalikan daftar kosong yang membingungkan. Cabang
 * pengampu tetap dipertahankan untuk peran yang cakupannya memang sempit
 * (mis. MAHASISWA bila suatu saat menyentuh jalur ini): tanpanya, pengampu
 * lintas prodi di luar cakupan itu tidak akan pernah melihat RPKPS-nya di
 * daftar — hanya bisa membukanya lewat tautan langsung.
 */
export function saringDaftarRpkps(sesi: PenggunaSesi) {
  const cakupan = cakupanKurikulum(sesi);
  if (cakupan === null) return {};
  return {
    OR: [
      { mataKuliah: { kurikulum: { prodiId: { in: cakupan } } } },
      { pengampu: { some: { penggunaId: sesi.id } } },
    ],
  };
}
