/**
 * Kelengkapan terjemahan sebuah RPKPS.
 *
 * Murni: menghitung berapa medan berisi yang sudah punya pasangan berbahasa
 * Inggris. Angka ini TIDAK pernah memblokir apa pun — terjemahan bersifat
 * opsional, dan menjadikannya syarat pengajuan berarti menahan dokumen yang
 * sepenuhnya sah karena sebuah fitur tambahan (docs/11 §5.6).
 *
 * Yang dihitung hanya medan yang ADA ISINYA di bahasa Indonesia: topik kosong
 * bukan pekerjaan terjemahan yang tertinggal, ia memang tidak ada.
 */

export interface PasanganTeks {
  asal: string | null | undefined;
  terjemahan: string | null | undefined;
}

export interface KelengkapanTerjemahan {
  /** Medan berisi yang punya pasangan Inggris. */
  terisi: number;
  /** Medan berisi seluruhnya — penyebutnya. */
  total: number;
  persen: number;
  /** Terjemahan sudah dimulai tetapi belum selesai. */
  sebagian: boolean;
}

const berisi = (v: string | null | undefined) => (v ?? "").trim().length > 0;

export function hitungKelengkapan(
  pasangan: readonly PasanganTeks[],
): KelengkapanTerjemahan {
  const perlu = pasangan.filter((p) => berisi(p.asal));
  const total = perlu.length;
  const terisi = perlu.filter((p) => berisi(p.terjemahan)).length;
  const persen = total === 0 ? 0 : Math.round((terisi / total) * 100);
  return { terisi, total, persen, sebagian: terisi > 0 && terisi < total };
}
