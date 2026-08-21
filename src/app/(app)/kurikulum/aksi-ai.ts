"use server";

import { wajibPeran } from "@/lib/otorisasi";
import { GalatAi } from "@/lib/ai/klien";
import { usulkanPerbaikan } from "@/lib/ai/perbaikan-kurikulum";
import { validasiKurikulum } from "@/domain/kurikulum/validator";
import {
  konteksPerbaikan,
  periksaUsulan,
  temuanUntukAi,
  type UsulanDitolak,
  type UsulanPerbaikan,
} from "@/domain/kurikulum/perbaikan";
import type { KurikulumInput } from "@/domain/kurikulum/tipe";

export interface HasilUsulanAi {
  ok: boolean;
  pesan?: string;
  usulan?: UsulanPerbaikan[];
  /** Penyedia dan model yang menghasilkan usulan ini. */
  penyedia?: string;
  model?: string;
  /** Usulan yang gagal pemeriksaan kode — ditampilkan supaya tidak hilang diam-diam. */
  ditolak?: UsulanDitolak[];
}

/**
 * Meminta AI mengusulkan perbaikan atas temuan pratinjau impor.
 *
 * Tidak menyimpan apa pun. Validasi dijalankan ULANG di sini terhadap
 * kurikulum kiriman klien, bukan memercayai daftar temuan yang dikirim —
 * kalau tidak, klien bisa mengarang temuan untuk menyetir prompt.
 */
export async function usulkanPerbaikanImpor(
  kurikulum: KurikulumInput,
): Promise<HasilUsulanAi> {
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const validasi = validasiKurikulum(kurikulum);
  const temuan = temuanUntukAi([...validasi.pemblokir, ...validasi.peringatan]);
  if (temuan.length === 0) {
    return { ok: false, pesan: "Tidak ada temuan yang dapat dikerjakan AI." };
  }

  try {
    const { usulan, penyedia, model } = await usulkanPerbaikan({
      penggunaId: sesi.id,
      konteks: konteksPerbaikan(kurikulum, temuan),
    });

    // Keluaran model diperiksa terhadap kurikulum yang sebenarnya: kode harus
    // ada, CPL harus sah, kode Sub-CPMK baru tidak boleh bentrok.
    const { sah, ditolak } = periksaUsulan(kurikulum, usulan);

    if (sah.length === 0) {
      return {
        ok: false,
        pesan:
          ditolak.length > 0
            ? "Semua usulan AI gagal pemeriksaan dan tidak dapat dipakai."
            : "AI tidak menghasilkan usulan untuk temuan ini.",
        ditolak,
        penyedia,
        model,
      };
    }

    return { ok: true, usulan: sah, ditolak, penyedia, model };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[kurikulum] gagal meminta usulan AI:", galat);
    return { ok: false, pesan: "Gagal meminta usulan AI. Periksa log server." };
  }
}
