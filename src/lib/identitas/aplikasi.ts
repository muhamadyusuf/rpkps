import "server-only";
import { env } from "@/lib/env";
import { uraiDaftarAplikasi, type AplikasiTerhubung } from "@/domain/rupa/aplikasi";
import { ambilDariIdentitas } from "./klien";

/**
 * Aplikasi terhubung untuk kisi "Aplikasi terhubung" di pusat kontrol
 * (docs/28 §4.2), dibaca dari registri identitas-itts — satu daftar untuk
 * semua aplikasi klien, dikelola admin di identitas-itts `/klien`.
 *
 * Kelompok itu NAVIGASI TAMBAHAN, bukan data: pemuat ini tidak pernah
 * melempar. Layanan yang lambat atau mati berarti panel tanpa aplikasi lain
 * — bukan halaman yang gagal dirender. Karena itu:
 *   - batas waktunya pendek (bukan 8 detik milik gerbang kepegawaian);
 *   - hasilnya disimpan 10 menit per instans, kegagalan 1 menit, supaya
 *     layanan yang mati tidak dipanggil ulang di setiap perpindahan halaman;
 *   - tata letak memanggilnya TANPA `await` dan meneruskan janjinya ke
 *     pusat kontrol di balik Suspense, jadi halaman tidak menunggu jaringan sama sekali.
 */

const UMUR_MS = 10 * 60_000;
const UMUR_GAGAL_MS = 60_000;
const BATAS_WAKTU_MS = 2500;

let simpanan: { sampai: number; data: AplikasiTerhubung[] } | null = null;

export async function muatAplikasiTerhubung(): Promise<AplikasiTerhubung[]> {
  const k = env.identitasItts;
  if (!k) return [];
  if (simpanan && Date.now() < simpanan.sampai) return simpanan.data;

  try {
    const json = await ambilDariIdentitas("/api/v1/aplikasi", {}, BATAS_WAKTU_MS);
    const data = uraiDaftarAplikasi(json, k.klienId);
    simpanan = { sampai: Date.now() + UMUR_MS, data };
    return data;
  } catch (galat) {
    // Pesan `GalatIdentitas` tidak memuat rahasia klien (lihat klien.ts).
    console.warn(`[aplikasi-terhubung] ${(galat as Error).message}`);
    const data = simpanan?.data ?? [];
    simpanan = { sampai: Date.now() + UMUR_GAGAL_MS, data };
    return data;
  }
}

/**
 * Desktop identitas-itts — tujuan "‹ Identitas ITTS" di kepala sidebar
 * (docs/28 §4.1). Tidak lewat registri: alamatnya sudah diketahui dari
 * konfigurasi integrasi, dan jalan pulang ini justru yang paling perlu tetap
 * ada saat registrinya tidak terjangkau.
 */
export function tautanIdentitasItts(): string | null {
  const url = env.identitasItts?.url;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
