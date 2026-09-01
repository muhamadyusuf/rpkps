"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import { type Bahasa, type Kamus } from "@/kamus";
import { jalur, lepasAwalan } from "@/lib/bahasa/jalur";
import { isi, jamak, type PolaJamak, type Sisipan } from "@/lib/bahasa/teks";

/**
 * Bahasa aktif untuk sisi klien.
 *
 * Client Component tidak dapat memanggil `next/root-params`, jadi bahasa dan
 * kamusnya diturunkan dari tata letak akar lewat context. Kamus dapat
 * menyeberang batas server–klien justru karena aturan bentuknya: seluruh
 * nilainya string, tanpa satu pun fungsi (docs/11-dwibahasa.md §3.2).
 */

interface Nilai {
  bahasa: Bahasa;
  /** Kamus. Dinamai sependek mungkin karena muncul di hampir setiap baris JSX. */
  k: Kamus;
  isi: (pola: string, sisipan?: Sisipan) => string;
  jamak: (pola: PolaJamak, jumlah: number, sisipan?: Sisipan) => string;
  /**
   * Alamat internal berawalan bahasa. Dipakai `router.push`/`router.replace`
   * dan tempat lain yang tidak melewati komponen `Tautan`.
   */
  jalur: (href: string) => string;
}

const KonteksBahasa = createContext<Nilai | null>(null);

export function PenyediaBahasa({
  bahasa,
  kamus,
  children,
}: {
  bahasa: Bahasa;
  kamus: Kamus;
  children: React.ReactNode;
}) {
  // Tanpa useMemo, objek baru tiap render membuat SELURUH konsumen ikut
  // dirender ulang — dan konsumennya adalah hampir setiap komponen klien.
  const nilai = useMemo<Nilai>(
    () => ({
      bahasa,
      k: kamus,
      isi,
      jamak: (pola, jumlah, sisipan) => jamak(pola, jumlah, bahasa, sisipan),
      jalur: (href) => jalur(href, bahasa),
    }),
    [bahasa, kamus],
  );

  return <KonteksBahasa.Provider value={nilai}>{children}</KonteksBahasa.Provider>;
}

export function useBahasa(): Nilai {
  const nilai = useContext(KonteksBahasa);
  if (!nilai) {
    throw new Error(
      "useBahasa dipanggil di luar PenyediaBahasa. Penyedia dipasang di tata letak akar src/app/[bahasa]/layout.tsx.",
    );
  }
  return nilai;
}

/**
 * Alamat halaman saat ini TANPA awalan bahasa.
 *
 * `usePathname` mengembalikan `/en/rpkps`, sedangkan navigasi membandingkannya
 * dengan `href` yang ditulis tanpa bahasa (`/rpkps`). Tanpa pelepasan awalan,
 * tidak ada satu pun butir menu yang pernah tampak aktif dalam bahasa apa pun
 * — kegagalan senyap yang hanya terlihat kalau seseorang memperhatikan bahwa
 * penanda modul tidak pernah menyala.
 */
export function useJalurTanpaBahasa(): string {
  return lepasAwalan(usePathname());
}
