"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  CalendarRange,
  FileText,
  GitPullRequestArrow,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ButirMenu, KunciIkon } from "@/lib/menu";
import { cn } from "@/lib/utils";

const IKON: Record<KunciIkon, LucideIcon> = {
  dasbor: LayoutDashboard,
  kurikulum: BookMarked,
  usulan: GitPullRequestArrow,
  rpkps: FileText,
  evaluasi: LineChart,
  beban: Timer,
  prodi: GraduationCap,
  tahun: CalendarRange,
  pengguna: Users,
  kunci: KeyRound,
};

function sedangAktif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Rel navigasi. Modul yang sedang dibuka ditandai batang cahaya di tepi kiri
 * bilah — bukan blok warna penuh — supaya daftar tetap tenang dan mata langsung
 * tahu posisinya di dalam aplikasi.
 */
export function NavigasiSamping({ menu }: { menu: readonly ButirMenu[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2.5 py-3">
      <p className="label-teknis mb-2 px-2.5 text-muted-foreground/70">Modul</p>

      <div className="space-y-0.5">
        {menu.map(({ href, label, ikon }) => {
          const Ikon = IKON[ikon];
          const aktif = sedangAktif(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ease-presisi",
                "before:absolute before:top-1/2 before:-left-2.5 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-cahaya before:transition-opacity before:duration-200 before:content-['']",
                aktif
                  ? "bg-cahaya/10 text-foreground before:opacity-100 before:shadow-[0_0_10px_var(--cahaya)]"
                  : "text-muted-foreground before:opacity-0 hover:bg-sidebar-accent hover:text-foreground active:scale-[0.985]",
              )}
            >
              <Ikon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  aktif ? "text-cahaya" : "opacity-75",
                )}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Bilah keping yang dapat digulir untuk layar sempit. */
export function NavigasiPonsel({ menu }: { menu: readonly ButirMenu[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {menu.map(({ href, label, ikon }) => {
        const Ikon = IKON[ikon];
        const aktif = sedangAktif(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-presisi",
              aktif
                ? "border-cahaya/45 bg-cahaya/12 text-foreground shadow-cahaya"
                : "border-border bg-muted/50 text-muted-foreground active:scale-95",
            )}
          >
            <Ikon
              className={cn("size-3.5 shrink-0", aktif ? "text-cahaya" : "")}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
