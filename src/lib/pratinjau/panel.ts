/**
 * Preferensi panel pratinjau: terbuka atau tidak, dan selebar apa.
 *
 * Disimpan di COOKIE, bukan `localStorage`, karena keputusan "terbuka" harus
 * diketahui SERVER: naskah dirender di sana, dan panel yang tertutup tidak
 * boleh membayar satu pun kueri. `localStorage` baru terbaca setelah halaman
 * sampai di peramban — terlambat untuk memutuskan apa yang dimuat.
 *
 * Lebarnya ikut menumpang cookie yang sama supaya lebar terakhir sudah
 * terpasang pada render pertama; tanpa itu panel selalu terbuka pada lebar
 * bawaan lalu meloncat ke lebar pengguna satu frame kemudian.
 *
 * Berkas ini SENGAJA tanpa `server-only`: ia dibaca halaman di server dan
 * ditulis panel di peramban, dan formatnya hanya benar selama keduanya
 * memakai pengurai yang sama.
 */

export const NAMA_COOKIE_PANEL = "pratinjau_rpkps";

/** Batas lebar panel, dalam piksel. */
export const LEBAR_MIN = 340;
export const LEBAR_MAKS = 1100;
export const LEBAR_BAWAAN = 560;

export interface PreferensiPanel {
  terbuka: boolean;
  lebar: number;
}

const BAWAAN: PreferensiPanel = { terbuka: false, lebar: LEBAR_BAWAAN };

/** `"1:560"` → `{ terbuka: true, lebar: 560 }`. Nilai aneh jatuh ke bawaan. */
export function bacaPreferensiPanel(nilai: string | undefined): PreferensiPanel {
  if (!nilai) return BAWAAN;
  const [buka, lebar] = nilai.split(":");
  const angka = Number(lebar);
  return {
    terbuka: buka === "1",
    lebar: Number.isFinite(angka) ? jepitLebar(angka) : LEBAR_BAWAAN,
  };
}

export function tulisPreferensiPanel(p: PreferensiPanel): string {
  return `${p.terbuka ? "1" : "0"}:${Math.round(jepitLebar(p.lebar))}`;
}

export function jepitLebar(lebar: number): number {
  return Math.min(LEBAR_MAKS, Math.max(LEBAR_MIN, lebar));
}
