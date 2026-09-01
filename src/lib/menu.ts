import type { Peran } from "@/generated/prisma";
import type { Kamus } from "@/kamus";

/**
 * Satu sumber kebenaran untuk menu utama. Ikon disebut lewat kunci teks,
 * bukan komponen, agar daftar ini aman dilewatkan dari server ke klien.
 */
/**
 * Kunci label di dalam `kamus.menu`. Menyimpan KUNCI, bukan kalimat: daftar
 * ini dirakit di server lalu dilewatkan ke navigasi di klien, dan kalimatnya
 * baru dipilih di sana menurut bahasa yang aktif.
 */
export type KunciMenu = keyof Kamus["menu"];

export type ButirMenu = {
  href: string;
  label: KunciMenu;
  ikon: KunciIkon;
  /** null = terbuka untuk semua pengguna aktif. */
  peran: readonly Peran[] | null;
  /**
   * Angka kecil di sisi kanan butir, mis. notifikasi belum dibaca. Diisi saat
   * render oleh tata letak — bukan bagian daftar tetap ini, karena nilainya
   * berubah tiap muat halaman.
   */
  lencana?: number;
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
  | "kunci"
  | "lonceng";

export const MENU: readonly ButirMenu[] = [
  { href: "/dashboard", label: "dasbor", ikon: "dasbor", peran: null },
  { href: "/notifikasi", label: "notifikasi", ikon: "lonceng", peran: null },
  { href: "/kurikulum", label: "kurikulum", ikon: "kurikulum", peran: null },
  { href: "/usulan", label: "usulan", ikon: "usulan", peran: null },
  { href: "/rpkps", label: "rpkps", ikon: "rpkps", peran: null },
  { href: "/evaluasi", label: "evaluasi", ikon: "evaluasi", peran: null },
  {
    href: "/kebijakan",
    label: "beban",
    ikon: "beban",
    peran: ["ADMIN", "GPM"],
  },
  {
    href: "/master/prodi",
    label: "prodi",
    ikon: "prodi",
    peran: ["ADMIN"],
  },
  {
    href: "/master/tahun-akademik",
    label: "tahun",
    ikon: "tahun",
    peran: ["ADMIN"],
  },
  { href: "/pengguna", label: "pengguna", ikon: "pengguna", peran: ["ADMIN"] },
  // Kunci AI milik masing-masing pengguna (docs/08), bukan pengaturan admin.
  { href: "/pengaturan/ai", label: "kunciAi", ikon: "kunci", peran: null },
];
