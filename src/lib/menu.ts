import type { Peran } from "@/generated/prisma";

/**
 * Satu sumber kebenaran untuk menu utama. Ikon disebut lewat kunci teks,
 * bukan komponen, agar daftar ini aman dilewatkan dari server ke klien.
 */
export type ButirMenu = {
  href: string;
  label: string;
  ikon: KunciIkon;
  /** null = terbuka untuk semua pengguna aktif. */
  peran: readonly Peran[] | null;
};

export type KunciIkon =
  | "dasbor"
  | "kurikulum"
  | "usulan"
  | "evaluasi"
  | "rpkps"
  | "beban"
  | "prodi"
  | "tahun"
  | "pengguna"
  | "kunci";

export const MENU: readonly ButirMenu[] = [
  { href: "/dashboard", label: "Dasbor", ikon: "dasbor", peran: null },
  { href: "/kurikulum", label: "Kurikulum", ikon: "kurikulum", peran: null },
  { href: "/usulan", label: "Usulan Revisi", ikon: "usulan", peran: null },
  { href: "/rpkps", label: "RPKPS", ikon: "rpkps", peran: null },
  { href: "/evaluasi", label: "Evaluasi Capaian", ikon: "evaluasi", peran: null },
  {
    href: "/kebijakan",
    label: "Beban Belajar",
    ikon: "beban",
    peran: ["ADMIN", "GPM"],
  },
  {
    href: "/master/prodi",
    label: "Program Studi",
    ikon: "prodi",
    peran: ["ADMIN"],
  },
  {
    href: "/master/tahun-akademik",
    label: "Tahun Akademik",
    ikon: "tahun",
    peran: ["ADMIN"],
  },
  { href: "/pengguna", label: "Pengguna", ikon: "pengguna", peran: ["ADMIN"] },
  // Kunci AI milik masing-masing pengguna (docs/08), bukan pengaturan admin.
  { href: "/pengaturan/ai", label: "Kunci AI", ikon: "kunci", peran: null },
];
