import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { GalatAi } from "./galat";
import { pilihPenyedia } from "./klien";
import type { AlasanBerhenti, PemakaianToken } from "./penyedia/tipe";

/**
 * Gerbang AI — satu-satunya jalan keluar menuju penyedia LLM.
 *
 * Alur docs/01 §4.1: resolusi kredensial → panggil penyedia → validasi
 * keluaran terhadap skema → catat pemakaian. Otorisasi dan perakitan konteks
 * dikerjakan pemanggil, karena keduanya bergantung pada domain.
 *
 * Gerbang tidak tahu penyedia mana yang dipakai. Itu yang membuat penggantian
 * penyedia tidak menyentuh satu pun aturan akademik di src/domain.
 */

export interface PermintaanAi<T> {
  /** Kode tugas, mis. "PERBAIKAN_IMPOR". Masuk ke log audit. */
  kodeTugas: string;
  penggunaId: string;
  entitasId?: string;
  /**
   * Blok STABIL: panduan dan kamus yang sama untuk setiap pemanggilan tugas
   * ini. Pada penyedia yang mendukung caching, blok ini yang di-cache — jadi
   * jangan pernah menyisipkan tanggal, id sesi, atau nama pengguna ke
   * dalamnya, karena satu byte berubah membatalkan seluruh cache
   * (docs/01 §4.3).
   */
  panduan: string;
  /** Blok BERUBAH: konteks spesifik permintaan ini. */
  permintaan: string;
  skema: z.ZodType<T>;
  maxTokens?: number;
}

export interface HasilAi<T> {
  data: T;
  penyedia: string;
  model: string;
  latensiMs: number;
}

const PESAN_GAGAL: Record<Exclude<AlasanBerhenti, "SELESAI">, string> = {
  DITOLAK: "Model menolak memproses permintaan ini.",
  TERPOTONG:
    "Jawaban AI terpotong karena terlalu panjang. Kurangi jumlah temuan yang dikerjakan sekaligus.",
  SKEMA_GAGAL: "Keluaran AI tidak sesuai skema yang diminta.",
};

export async function jalankanTugasAi<T>(p: PermintaanAi<T>): Promise<HasilAi<T>> {
  const { penyedia, model } = pilihPenyedia();
  const mulai = Date.now();

  const jawaban = await penyedia.chat({
    model,
    panduan: p.panduan,
    permintaan: p.permintaan,
    skema: p.skema,
    maxTokens: p.maxTokens ?? 16000,
  });

  const latensiMs = Date.now() - mulai;
  await catat(p, penyedia.kode, model, latensiMs, jawaban.pemakaian, jawaban.alasan);

  if (jawaban.alasan !== "SELESAI" || !jawaban.data) {
    throw new GalatAi(
      PESAN_GAGAL[jawaban.alasan as Exclude<AlasanBerhenti, "SELESAI">] ??
        PESAN_GAGAL.SKEMA_GAGAL,
    );
  }

  return { data: jawaban.data, penyedia: penyedia.kode, model, latensiMs };
}

/**
 * Mencatat pemakaian ke log audit.
 *
 * docs/01 §4.8 merancang tabel ai_usage_log tersendiri; selama kunci masih
 * satu milik institusi, log_audit sudah memuat semua yang dibutuhkan untuk
 * menjawab "siapa memanggil apa, dengan penyedia mana, dan berapa tokennya".
 */
async function catat<T>(
  p: PermintaanAi<T>,
  penyedia: string,
  model: string,
  latensiMs: number,
  pemakaian: PemakaianToken | null,
  status: AlasanBerhenti,
) {
  try {
    await prisma.logAudit.create({
      data: {
        penggunaId: p.penggunaId,
        aksi: `AI_${p.kodeTugas}`,
        entitas: "ai",
        entitasId: p.entitasId ?? null,
        ringkasan: `${penyedia}/${model} · ${status} · ${latensiMs} ms`,
        data: { penyedia, model, status, latensiMs, ...(pemakaian ?? {}) },
      },
    });
  } catch (galat) {
    // Gagal mencatat tidak boleh menggagalkan pekerjaan dosen.
    console.error("[ai] gagal mencatat pemakaian:", galat);
  }
}
