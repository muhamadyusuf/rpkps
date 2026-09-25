import {
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  CalendarRange,
  Crosshair,
  FileText,
  GitPullRequestArrow,
  Globe,
  GraduationCap,
  House,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  List,
  Monitor,
  Network,
  PenLine,
  Shield,
  ShieldAlert,
  Timer,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { KunciIkon } from "@/lib/menu";
import type { IkonAplikasi, WarnaUbin } from "@/domain/rupa/aplikasi";
import { cn } from "@/lib/utils";

export type { WarnaUbin };

/**
 * Ikon dan warna modul — satu tempat, dipakai sidebar (docs/28).
 *
 * Warnanya ditetapkan di KOMPONEN, bukan di `src/lib/menu.ts`: daftar menu
 * adalah wewenang dan urutan, dan tidak perlu tahu rupa apa yang sedang
 * dipakai. `Record<KunciIkon, …>` membuat kompilator menolak kunci ikon baru
 * yang lupa diberi ikon atau warna.
 */
export const IKON_MODUL: Record<KunciIkon, LucideIcon> = {
  dasbor: LayoutDashboard,
  kurikulum: BookMarked,
  usulan: GitPullRequestArrow,
  rpkps: FileText,
  buku: BookOpen,
  evaluasi: LineChart,
  beban: Timer,
  prodi: GraduationCap,
  tahun: CalendarRange,
  pengguna: Users,
  kunci: KeyRound,
  lonceng: Bell,
  perisai: ShieldAlert,
};

/** Padanan lucide untuk kosakata ikon registri identitas-itts (`IKON_DESKTOP`). */
export const IKON_APLIKASI: Record<IkonAplikasi, LucideIcon> = {
  aplikasi: LayoutGrid,
  buku: BookOpen,
  unit: Building2,
  orang: User,
  orangBanyak: Users,
  pohon: Network,
  grafik: BarChart3,
  rumah: House,
  bola: Globe,
  kunci: KeyRound,
  perisai: Shield,
  layar: Monitor,
  daftar: List,
  pena: PenLine,
  bidik: Crosshair,
};

/** Kelas harfiah: Tailwind hanya membangkitkan kelas yang tertulis utuh. */
const KELAS_WARNA: Record<WarnaUbin, string> = {
  biru: "bg-ubin-biru",
  hijau: "bg-ubin-hijau",
  jingga: "bg-ubin-jingga",
  ungu: "bg-ubin-ungu",
  nila: "bg-ubin-nila",
  merah: "bg-ubin-merah",
  teal: "bg-ubin-teal",
  abu: "bg-ubin-abu",
  kuning: "bg-ubin-kuning",
  cokelat: "bg-ubin-cokelat",
  merahmuda: "bg-ubin-merahmuda",
  grafit: "bg-ubin-grafit",
};

export const WARNA_MODUL: Record<KunciIkon, WarnaUbin> = {
  dasbor: "abu",
  lonceng: "merah",
  kurikulum: "nila",
  usulan: "jingga",
  rpkps: "biru",
  buku: "cokelat",
  evaluasi: "hijau",
  beban: "teal",
  prodi: "ungu",
  tahun: "merahmuda",
  pengguna: "abu",
  kunci: "kuning",
  perisai: "grafit",
};

/**
 * Ubin ikon. Ukurannya dari `className`; ikon di dalamnya mengikuti sebagai
 * persentase. Untuk baris menu, pakai `UbinMenu`.
 */
export function Ubin({
  ikon: Ikon,
  warna,
  lencana,
  className,
}: {
  ikon: LucideIcon;
  warna: WarnaUbin;
  /** Bulatan di pojok — jumlah belum dibaca (lajur ringkas). Kosong/0: tidak tampil. */
  lencana?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ubin-aplikasi relative flex shrink-0 items-center justify-center text-white transition-transform duration-200 ease-presisi",
        KELAS_WARNA[warna],
        className,
      )}
    >
      <Ikon aria-hidden strokeWidth={1.8} className="h-[48%] w-[48%]" />
      {lencana ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1.5 min-w-3.5 rounded-full bg-bahaya px-1 text-center font-mono text-[9px] leading-[14px] font-semibold text-white tabular-nums ring-2 ring-permukaan-2"
        >
          {lencana > 9 ? "9+" : lencana}
        </span>
      ) : null}
    </span>
  );
}

/** Ubin 26px untuk baris menu — ukuran `UbinMenu` identitas-itts. */
export function UbinMenu({ ikon, warna, lencana }: { ikon: LucideIcon; warna: WarnaUbin; lencana?: number }) {
  return <Ubin ikon={ikon} warna={warna} lencana={lencana} className="size-[26px] rounded-[7px] shadow-b1" />;
}
