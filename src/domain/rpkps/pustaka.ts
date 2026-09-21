import type { JenisPustaka } from "@/generated/prisma";

/**
 * Urutan baku jenis pustaka pada dokumen.
 *
 * Bagian G mencetak kelompoknya dalam urutan ini, dan kolom Referensi pada
 * tabel mingguan (bagian H) menyebut kelompok yang sama dengan urutan yang
 * sama. Dulu larik ini ditulis ulang di `naskah.tsx` dan `rpkps-docx.ts`:
 * dua berkas yang menghasilkan SATU dokumen yang sama, jadi begitu keduanya
 * menyimpang pratinjau dan berkas cetaknya berbeda tanpa satu galat pun.
 */
export const URUT_JENIS_PUSTAKA = [
  "UTAMA",
  "PENDUKUNG",
  "DARING",
  "TOOLS",
] as const satisfies readonly JenisPustaka[];

/**
 * Pustaka dikelompokkan per jenis, dalam urutan baku, bernomor menaik.
 *
 * Ini yang membuat kutipan pada tabel mingguan dapat dibaca. `pustaka` unik
 * pada `(rpkpsId, jenis, nomor)` — penomorannya MULAI DARI SATU LAGI di tiap
 * kelompok — jadi "[1]" telanjang dapat berarti Sumber Utama nomor 1 atau
 * Sumber Belajar Daring nomor 1, dua bahan yang sama sekali berbeda. Yang
 * menjadikannya satu rujukan yang utuh adalah pasangan jenis + nomor, dan
 * karena itu keduanya harus tercetak bersama.
 *
 * Jenis yang belum ada di `URUT_JENIS_PUSTAKA` ikut di belakang, bukan
 * dibuang: menambah satu anggota enum tanpa menyentuh berkas ini harus
 * berakibat rujukannya tercetak di urutan yang salah — bukan lenyap dari
 * dokumen tanpa jejak.
 */
export function kelompokkanPustaka<T extends { jenis: string; nomor: number }>(
  daftar: readonly T[],
): { jenis: string; butir: T[] }[] {
  const kelompok = new Map<string, T[]>();
  for (const p of daftar) {
    const ada = kelompok.get(p.jenis);
    if (ada) ada.push(p);
    else kelompok.set(p.jenis, [p]);
  }

  const urut: string[] = [
    ...URUT_JENIS_PUSTAKA.filter((j) => kelompok.has(j)),
    ...[...kelompok.keys()].filter(
      (j) => !(URUT_JENIS_PUSTAKA as readonly string[]).includes(j),
    ),
  ];

  return urut.map((jenis) => ({
    jenis,
    butir: [...kelompok.get(jenis)!].sort((a, b) => a.nomor - b.nomor),
  }));
}
