"use server";

import { prisma } from "@/lib/prisma";
import { punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import type { PenggunaSesi } from "@/lib/sesi";
import { segarkan } from "@/lib/bahasa/segarkan";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { GalatAi } from "@/lib/ai/galat";
import { susunDrafUsulan as panggilModel } from "@/lib/ai/draf-usulan";
import { rakitBahanDraf, tulisButirDraf, type BahanLengkap } from "@/lib/kurikulum/bahan-draf";
import {
  keBentukMentah,
  saringDrafUsulan,
  type ButirDibuang,
} from "@/domain/kurikulum/draf-usulan";
import type { ButirInput } from "@/domain/kurikulum/usulan";
import { PESAN_KLIEN_BASI, klienBasi } from "@/lib/galat-prisma";

/**
 * Draf AI untuk Usulan Revisi Kurikulum — fase U3c.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §9.5.
 *
 * Alurnya meniru draf RPKPS, karena polanya sudah dipahami dosen:
 *
 *   periksaKesiapanDraf → susunDrafAi → (dosen mencentang) → terapkanDrafAi
 *
 * Dua hal yang membedakannya, dan keduanya berasal dari §9.2:
 *
 * 1. **Draf tidak pernah langsung diajukan.** Ia mendarat sebagai butir pada
 *    usulan DRAF milik dosen, yang masih harus ia baca, sunting, dan ajukan
 *    sendiri. `sumber = AI` ikut tersimpan dan ditahan apa adanya setelah
 *    disahkan.
 * 2. **Penerapan menyaring ULANG.** Butir yang dikirim balik peramban tidak
 *    dipercaya sedikit pun: kutipan dasarnya dibuang dan disalin lagi dari
 *    katalog yang dirakit server saat itu juga. Tanpa itu, seluruh penjagaan
 *    §9.2 dapat dilewati dengan satu permintaan buatan tangan.
 */

const PERAN_PENGUSUL = ["ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN"] as const;

export interface HasilKesiapanDraf {
  ok: boolean;
  pesan?: string;
  ringkas?: BahanLengkap["ringkas"];
}

export interface HasilDrafUsulan {
  ok: boolean;
  pesan?: string;
  butir?: ButirInput[];
  dibuang?: ButirDibuang[];
  penyedia?: string;
  model?: string;
  msModel?: number;
}

export interface HasilTerapDraf {
  ok: boolean;
  pesan: string;
}

type Konteks = {
  sesi: PenggunaSesi;
  usulan: {
    id: string;
    status: string;
    kurikulumId: string;
    mataKuliahId: string | null;
    diajukanOlehId: string;
  };
};

/**
 * Kewenangan dan keadaan. Sama seperti `tambahButir`: draf AI adalah cara lain
 * menambah butir, bukan pintu lain — jadi syaratnya wajib sama persis, dan
 * usulan yang sudah diajukan tidak boleh kedatangan butir baru dari mana pun.
 */
async function pastikanWenang(
  usulanId: string,
): Promise<Konteks | { pesan: string }> {
  const kam = await kamusAksi();
  const sesi = await wajibAktif();

  const usulan = await prisma.usulanRevisi.findUnique({
    where: { id: usulanId },
    select: {
      id: true,
      status: true,
      kurikulumId: true,
      mataKuliahId: true,
      diajukanOlehId: true,
      kurikulum: { select: { prodiId: true } },
    },
  });
  if (!usulan) return { pesan: kam.aksi.takAda.usulan };

  if (!punyaPeranDiProdi(sesi, usulan.kurikulum.prodiId, ...PERAN_PENGUSUL)) {
    return { pesan: kam.aksi.wenang.atasUsulan };
  }
  if (usulan.status !== "DRAF" && usulan.status !== "DIREVISI") {
    return { pesan: kam.aksi.usulan.takDapatDisunting };
  }
  if (usulan.diajukanOlehId !== sesi.id) {
    return { pesan: kam.aksi.wenang.hanyaPengusulSunting };
  }

  return { sesi, usulan };
}

/**
 * Prasyarat draf, tanpa membakar satu token pun.
 *
 * Dipisah dari penyusunan supaya panel dapat menyebut apa yang sebenarnya
 * tersedia — berapa temuan validator, berapa temuan evaluasi — sebelum dosen
 * memutuskan memakai kuota kuncinya sendiri.
 */
export async function periksaKesiapanDraf(usulanId: string): Promise<HasilKesiapanDraf> {
  const kam = await kamusAksi();
  const akses = await pastikanWenang(usulanId);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const bahan = await rakitBahanDraf({
    kurikulumId: akses.usulan.kurikulumId,
    mataKuliahId: akses.usulan.mataKuliahId,
    catatanDosen: null,
  });
  if (!bahan) return { ok: false, pesan: kam.aksi.usulan.drafTanpaMk };

  // Katalog kosong berarti tidak ada yang dapat ditranskripsi. Memanggil model
  // tetap akan menghasilkan sesuatu — dan segalanya yang dihasilkannya akan
  // dibuang penyaring karena tidak berdasar. Lebih baik ditolak di sini.
  if (bahan.bahan.dasar.length === 0) {
    return { ok: false, pesan: kam.aksi.usulan.drafTanpaDasar };
  }

  return { ok: true, ringkas: bahan.ringkas };
}

/**
 * Menyusun draf dengan AI. TIDAK menyimpan apa pun.
 *
 * Yang dibuang penyaring dikembalikan apa adanya, bukan disembunyikan: draf
 * yang separuhnya dibuang tanpa keterangan terbaca sebagai model yang bekerja
 * baik, padahal justru sebaliknya (§9.3).
 */
export async function susunDrafAi(
  usulanId: string,
  catatanDosen: string,
  kredensialId?: string | null,
): Promise<HasilDrafUsulan> {
  const kam = await kamusAksi();
  const akses = await pastikanWenang(usulanId);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const bahan = await rakitBahanDraf({
    kurikulumId: akses.usulan.kurikulumId,
    mataKuliahId: akses.usulan.mataKuliahId,
    catatanDosen,
  });
  if (!bahan) return { ok: false, pesan: kam.aksi.usulan.drafTanpaMk };
  if (bahan.bahan.dasar.length === 0) {
    return { ok: false, pesan: kam.aksi.usulan.drafTanpaDasar };
  }

  const mulai = Date.now();
  try {
    const jawaban = await panggilModel({
      penggunaId: akses.sesi.id,
      usulanId,
      konteks: bahan.konteks,
      kredensialId,
    });

    const hasil = saringDrafUsulan(bahan.bahan, jawaban.butir);
    return {
      ok: true,
      butir: hasil.butir,
      dibuang: hasil.dibuang,
      penyedia: jawaban.penyedia,
      model: jawaban.model,
      msModel: Date.now() - mulai,
    };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[usulan] gagal menyusun draf:", galat);
    return { ok: false, pesan: kam.aksi.ai.gagalDraf };
  }
}

/**
 * Menerapkan butir yang dicentang dosen ke usulannya.
 *
 * Butir mendarat berstatus `BARU` dengan `sumber = AI`. Ia belum diajukan,
 * belum diputuskan, dan masih dapat disunting maupun dihapus dosen seperti
 * butir yang ia ketik sendiri.
 */
export async function terapkanDrafAi(
  usulanId: string,
  butirDipilih: ButirInput[],
  catatanDosen: string,
): Promise<HasilTerapDraf> {
  const kam = await kamusAksi();
  const akses = await pastikanWenang(usulanId);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  if (butirDipilih.length === 0) {
    return { ok: false, pesan: kam.aksi.usulan.drafTanpaPilihan };
  }

  const bahan = await rakitBahanDraf({
    kurikulumId: akses.usulan.kurikulumId,
    mataKuliahId: akses.usulan.mataKuliahId,
    catatanDosen,
  });
  if (!bahan) return { ok: false, pesan: kam.aksi.usulan.drafTanpaMk };

  // Penyaringan ULANG terhadap katalog yang baru dirakit — bukan terhadap
  // katalog saat pratinjau. Di antara keduanya bisa saja ada temuan evaluasi
  // yang sudah diteruskan orang lain, atau kurikulum yang sudah disunting.
  const hasil = saringDrafUsulan(bahan.bahan, butirDipilih.map(keBentukMentah));
  if (hasil.butir.length === 0) {
    return { ok: false, pesan: kam.aksi.usulan.drafTakLolos };
  }

  try {
    await tulisButirDraf({
      usulanId,
      butir: hasil.butir,
      refTemuanEvaluasi: bahan.refTemuanEvaluasi,
    });
  } catch (galat) {
    if (klienBasi(galat)) return { ok: false, pesan: PESAN_KLIEN_BASI };
    console.error("[usulan] gagal menerapkan draf:", galat);
    return { ok: false, pesan: kam.aksi.usulan.butirGagal };
  }

  segarkan("/usulan");
  segarkan(`/usulan/${usulanId}`);

  return {
    ok: true,
    pesan: sisip(kam.aksi.usulan.drafDiterapkan, { jumlah: hasil.butir.length }),
  };
}
