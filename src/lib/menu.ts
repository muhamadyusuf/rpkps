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
   * Kelompok di sidebar (docs/28 §4.3). Pengelompokan adalah struktur menu,
   * bukan rupa, jadi ia tinggal di sini bersama urutan dan wewenangnya.
   */
  grup: GrupMenu;
  /**
   * Angka kecil di sisi kanan butir, mis. notifikasi belum dibaca. Diisi saat
   * render oleh tata letak — bukan bagian daftar tetap ini, karena nilainya
   * berubah tiap muat halaman.
   */
  lencana?: number;
};

/** Urutan kelompok sidebar. `utama` tanpa judul. */
export const GRUP_MENU = ["utama", "akademik", "kebijakan", "dataInduk", "sistem"] as const;
export type GrupMenu = (typeof GRUP_MENU)[number];

export type KunciIkon =
  | "dasbor"
  | "kurikulum"
  | "usulan"
  | "evaluasi"
  | "rpkps"
  | "buku"
  | "beban"
  | "prodi"
  | "tahun"
  | "pengguna"
  | "kunci"
  | "lonceng"
  | "perisai";

export const MENU: readonly ButirMenu[] = [
  { href: "/dashboard", label: "dasbor", ikon: "dasbor", peran: null, grup: "utama" },
  { href: "/notifikasi", label: "notifikasi", ikon: "lonceng", peran: null, grup: "utama" },
  { href: "/kurikulum", label: "kurikulum", ikon: "kurikulum", peran: null, grup: "akademik" },
  { href: "/usulan", label: "usulan", ikon: "usulan", peran: null, grup: "akademik" },
  { href: "/rpkps", label: "rpkps", ikon: "rpkps", peran: null, grup: "akademik" },
  // Bahan ajar terbuka untuk semua pengguna aktif; yang membatasi siapa boleh
  // MENULIS adalah kepengampuan, dan itu diputuskan per buku (docs/16 §5.2).
  { href: "/bahan-ajar", label: "bahanAjar", ikon: "buku", peran: null, grup: "akademik" },
  { href: "/evaluasi", label: "evaluasi", ikon: "evaluasi", peran: null, grup: "akademik" },
  {
    href: "/kebijakan",
    label: "beban",
    ikon: "beban",
    peran: ["ADMIN", "GPM"],
    grup: "kebijakan",
  },
  {
    href: "/master/prodi",
    label: "prodi",
    ikon: "prodi",
    peran: ["ADMIN"],
    grup: "dataInduk",
  },
  {
    href: "/master/tahun-akademik",
    label: "tahun",
    ikon: "tahun",
    peran: ["ADMIN"],
    grup: "dataInduk",
  },
  { href: "/pengguna", label: "pengguna", ikon: "pengguna", peran: ["ADMIN"], grup: "dataInduk" },
  // Jejak pemindai yang menyentuh alamat umpan (docs/22). Hanya ADMIN: isinya
  // IP dan lokasi perkiraan orang, bukan data akademik.
  { href: "/perangkap", label: "perangkap", ikon: "perisai", peran: ["ADMIN"], grup: "sistem" },
  // Kunci AI milik masing-masing pengguna (docs/08), bukan pengaturan admin.
  { href: "/pengaturan/ai", label: "kunciAi", ikon: "kunci", peran: null, grup: "sistem" },
];
