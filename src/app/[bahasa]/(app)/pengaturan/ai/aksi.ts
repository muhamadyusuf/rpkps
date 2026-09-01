"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { wajibAktif } from "@/lib/otorisasi";
import { kamusAksi } from "@/lib/bahasa/server";
import { GalatAi } from "@/lib/ai/galat";
import {
  hapusKredensial,
  jadikanBawaan,
  simpanKredensial,
  SkemaKredensial,
  ubahAktif,
  ujiKunci,
} from "@/lib/ai/kredensial";
import type { PenyediaAi } from "@/generated/prisma";
import { pesanZod } from "@/lib/bahasa/zod";

export type Hasil = { ok: boolean; pesan: string };

/**
 * Pengelolaan kunci AI milik dosen sendiri — docs/08.
 *
 * Setiap aksi memakai `sesi.id` sebagai pemilik dan TIDAK PERNAH menerima
 * penggunaId dari klien: kunci orang lain tidak boleh dapat disentuh walau
 * id-nya ditebak dengan benar. Admin pun tidak punya jalur ke sini — kunci
 * pribadi bukan data kepegawaian.
 */

function pesanGalat(galat: unknown, bawaan: string): string {
  if (galat instanceof GalatAi) return galat.message;
  console.error("[kunci-ai]", galat);
  return bawaan;
}

export async function tambahKunci(data: FormData): Promise<Hasil> {
  const sesi = await wajibAktif();
  const k = await kamusAksi();

  const kosongJadiNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  const urai = SkemaKredensial.safeParse({
    penyedia: String(data.get("penyedia") ?? ""),
    label: String(data.get("label") ?? ""),
    apiKey: String(data.get("apiKey") ?? ""),
    model: kosongJadiNull(data.get("model")),
  });
  if (!urai.success) {
    return { ok: false, pesan: pesanZod(urai.error, k, k.aksi.umum.masukanTidakSah) };
  }

  try {
    const hasil = await simpanKredensial(sesi.id, urai.data);
    if (hasil.ok) segarkan("/pengaturan/ai");
    return { ok: hasil.ok, pesan: hasil.pesan };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat, k.aksi.lain.gagalSimpanKunci) };
  }
}

/** Uji tanpa menyimpan — dipakai tombol "Uji koneksi" sebelum menekan Simpan. */
export async function ujiKunciBaru(
  penyedia: PenyediaAi,
  apiKey: string,
  model: string | null,
): Promise<Hasil> {
  await wajibAktif();
  const k = await kamusAksi();
  if (apiKey.trim().length < 16) {
    return { ok: false, pesan: k.aksi.ai.kunciTerlaluPendek };
  }
  try {
    return await ujiKunci(penyedia, apiKey.trim(), model?.trim() || null);
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat, "Uji koneksi gagal.") };
  }
}

export async function pilihBawaan(id: string): Promise<Hasil> {
  const sesi = await wajibAktif();
  const hasil = await jadikanBawaan(sesi.id, id);
  if (hasil.ok) segarkan("/pengaturan/ai");
  return hasil;
}

export async function setelAktif(id: string, aktif: boolean): Promise<Hasil> {
  const sesi = await wajibAktif();
  const hasil = await ubahAktif(sesi.id, id, aktif);
  if (hasil.ok) segarkan("/pengaturan/ai");
  return hasil;
}

export async function buangKunci(id: string): Promise<Hasil> {
  const sesi = await wajibAktif();
  const hasil = await hapusKredensial(sesi.id, id);
  if (hasil.ok) segarkan("/pengaturan/ai");
  return hasil;
}
