"use client";

import { Tautan } from "@/components/tautan";
import { useBahasa, useJalurTanpaBahasa } from "@/components/penyedia-bahasa";
import {
  Bell,
  BookMarked,
  BookOpen,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const IKON: Record<KunciIkon, LucideIcon> = {
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
};

/**
 * Angka belum-dibaca. Dibatasi "9+" supaya lebar butir menu tidak melar dan
 * angkanya tetap terbaca sebagai isyarat, bukan sebagai data.
 */
function Lencana({ jumlah, kecil }: { jumlah: number; kecil?: boolean }) {
  const { k, isi } = useBahasa();
  return (
    <span
      aria-label={isi(k.kerangka.belumDibaca, { jumlah })}
      className={cn(
        "ml-auto shrink-0 rounded-full bg-cahaya/15 font-mono tabular-nums text-cahaya ring-1 ring-cahaya/30",
        kecil ? "px-1 text-[10px] leading-4" : "px-1.5 text-[11px] leading-5",
      )}
    >
      {jumlah > 9 ? "9+" : jumlah}
    </span>
  );
}

function sedangAktif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Rel navigasi. Modul yang sedang dibuka ditandai batang cahaya di tepi kiri
 * bilah — bukan blok warna penuh — supaya daftar tetap tenang dan mata langsung
 * tahu posisinya di dalam aplikasi.
 */
export function NavigasiSamping({
  menu,
  ciut = false,
}: {
  menu: readonly ButirMenu[];
  /** Rel ikon saja: labelnya pindah ke penjelas, tidak hilang. */
  ciut?: boolean;
}) {
  const pathname = useJalurTanpaBahasa();
  const { k } = useBahasa();

  return (
    <nav className={cn("flex-1 py-3", ciut ? "px-2" : "px-2.5")}>
      {/*
        Judul kelompok tidak diciutkan menjadi singkatan: pada rel selebar ikon
        ia hanya akan menjadi teks yang tidak terbaca. Yang hilang di sana
        adalah tulisannya, bukan pengelompokannya — jaraknya tetap.
      */}
      {ciut ? (
        <div className="mb-2 h-4" aria-hidden />
      ) : (
        <p className="label-teknis mb-2 px-2.5 text-muted-foreground/70">
          {k.kerangka.modul}
        </p>
      )}

      <div className="space-y-0.5">
        {menu.map(({ href, label, ikon, lencana }) => {
          const Ikon = IKON[ikon];
          const aktif = sedangAktif(pathname, href);
          const nama = k.menu[label];

          const butir = (
            <Tautan
              key={href}
              href={href}
              aria-current={aktif ? "page" : undefined}
              /*
                Nama modul tetap terbaca pembaca layar saat rel ciut. Tanpa
                `aria-label`, tautan yang isinya hanya `<svg aria-hidden>`
                dibacakan sebagai "tautan" tanpa tujuan — dan seluruh menu
                menjadi dua belas tautan yang tidak dapat dibedakan.
              */
              aria-label={ciut ? nama : undefined}
              className={cn(
                "relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-presisi",
                ciut ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
                "before:absolute before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-cahaya before:transition-opacity before:duration-200 before:content-['']",
                ciut ? "before:-left-2" : "before:-left-2.5",
                aktif
                  ? "bg-cahaya/10 text-foreground before:opacity-100 before:shadow-[0_0_10px_var(--cahaya)]"
                  : "text-muted-foreground before:opacity-0 hover:bg-sidebar-accent hover:text-foreground active:scale-[0.985]",
              )}
            >
              <span className="relative flex shrink-0 items-center">
                <Ikon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    aktif ? "text-cahaya" : "opacity-75",
                  )}
                />
                {/*
                  Pada rel ciut angkanya tidak muat di samping ikon, jadi ia
                  menempel di pojoknya. Yang tidak boleh hilang adalah
                  ISYARATNYA — notifikasi yang tak terlihat sama saja dengan
                  notifikasi yang tidak ada.
                */}
                {ciut && lencana ? <Titik jumlah={lencana} /> : null}
              </span>
              {ciut ? null : <span className="truncate">{nama}</span>}
              {!ciut && lencana ? <Lencana jumlah={lencana} /> : null}
            </Tautan>
          );

          if (!ciut) return butir;
          return (
            <Tooltip key={href}>
              <TooltipTrigger render={<span className="block" />}>
                {butir}
              </TooltipTrigger>
              <TooltipContent side="right">{nama}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}

/** Lencana versi rel ciut: titik bernomor di pojok ikon. */
function Titik({ jumlah }: { jumlah: number }) {
  const { k, isi } = useBahasa();
  return (
    <span
      aria-label={isi(k.kerangka.belumDibaca, { jumlah })}
      className="absolute -top-1.5 -right-2 rounded-full bg-cahaya/20 px-1 font-mono text-[9px] leading-[14px] text-cahaya ring-1 ring-cahaya/40"
    >
      {jumlah > 9 ? "9+" : jumlah}
    </span>
  );
}

/** Bilah keping yang dapat digulir untuk layar sempit. */
export function NavigasiPonsel({ menu }: { menu: readonly ButirMenu[] }) {
  const pathname = useJalurTanpaBahasa();
  const { k } = useBahasa();

  return (
    <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {menu.map(({ href, label, ikon, lencana }) => {
        const Ikon = IKON[ikon];
        const aktif = sedangAktif(pathname, href);
        return (
          <Tautan
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
            {k.menu[label]}
            {lencana ? <Lencana jumlah={lencana} kecil /> : null}
          </Tautan>
        );
      })}
    </nav>
  );
}
