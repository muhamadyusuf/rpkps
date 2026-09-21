import { hitungSidik } from "@/domain/rpkps/sidik";

/**
 * Terpisah dari `templat.ts` dengan sengaja: berkas itu diimpor komponen KLIEN
 * (`panel-impor.tsx`, untuk nama lembar), sedangkan sidik memakai `node:crypto`
 * yang tidak dapat masuk ke bundel peramban.
 */

export interface SumberCap {
  rpkpsDiubah: Date;
  pertemuan: { id: string; diubahPada: Date }[];
  tugas: { id: string; diubahPada: Date }[];
  kisiKisi: { id: string; diubahPada: Date }[];
  komponen: { nama: string; bobot: number }[];
  jumlahPustaka: number;
}

/**
 * Penanda versi isi RPKPS. Pratinjau membacanya, terapkan memeriksanya lagi.
 *
 * Penerapan menulis ulang `pertemuan`, `tugas`, dan `kisi_kisi` sekaligus,
 * jadi cap satu baris tidak cukup (AGENTS.md: penyimpanan yang mengganti seluruh
 * isi wajib membawa cap versi). Yang dicap adalah seluruh himpunan barisnya:
 * baris yang berubah, ditambah, atau dihapus — semuanya menggeser sidik ini.
 */
export function capIsiRpkps(s: SumberCap): string {
  const cap = (b: { id: string; diubahPada: Date }) => `${b.id}:${b.diubahPada.toISOString()}`;
  return hitungSidik({
    r: s.rpkpsDiubah.toISOString(),
    p: s.pertemuan.map(cap).sort(),
    t: s.tugas.map(cap).sort(),
    k: s.kisiKisi.map(cap).sort(),
    n: s.komponen.map((c) => `${c.nama}:${c.bobot}`).sort(),
    u: s.jumlahPustaka,
  });
}
