"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { HasilSimpan } from "./aksi";

/**
 * Menjalankan satu aksi kurikulum: tunggu, laporkan, lalu segarkan.
 *
 * Dipakai bersama oleh penyunting CPL, mata kuliah, CPMK, dan profil lulusan.
 * `router.refresh()` tetap dipanggil meski aksi sudah memanggil `segarkan` di
 * server: yang pertama menyegarkan pohon rute yang sedang dirender di peramban
 * ini, yang kedua membatalkan cache di server. Tanpa yang pertama, penyunting
 * melihat daftar lama sampai ia berpindah halaman.
 *
 * Toast galat memakai `duration` panjang: pesan penolakan gerbang G2 menyebut
 * dokumen mana yang menghalangi, dan kalimat sepanjang itu tidak selesai
 * dibaca dalam empat detik bawaan.
 */
export function useAksiKurikulum() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const jalankan = (fn: () => Promise<HasilSimpan>, sesudah?: () => void) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        sesudah?.();
        router.refresh();
      } else {
        toast.error(hasil.pesan, { duration: 12_000 });
      }
    });

  return { menunggu, jalankan };
}
