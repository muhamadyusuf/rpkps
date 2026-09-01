"use client";

import { Tautan } from "@/components/tautan";
import { useBahasa, useJalurTanpaBahasa } from "@/components/penyedia-bahasa";
import { cn } from "@/lib/utils";

const TAUTAN = [
  { href: "/", label: "beranda" },
  { href: "/katalog", label: "katalog" },
] as const;

/**
 * Navigasi bilah atas halaman publik.
 *
 * Penanda halaman aktif memakai garis cahaya di BAWAH label — sejajar tepi
 * bilah — bukan batang di kiri seperti rel navigasi aplikasi. Arahnya
 * mendatar, jadi penandanya ikut mendatar.
 */
export function NavigasiPublik({ className }: { className?: string }) {
  const pathname = useJalurTanpaBahasa();
  const { k } = useBahasa();

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {TAUTAN.map(({ href, label }) => {
        const aktif =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Tautan
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-presisi",
              "after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-cahaya after:transition-opacity after:duration-200 after:content-['']",
              aktif
                ? "text-foreground after:opacity-100 after:shadow-[0_0_10px_var(--cahaya)]"
                : "text-muted-foreground after:opacity-0 hover:text-foreground",
            )}
          >
            {k.publik[label]}
          </Tautan>
        );
      })}
    </nav>
  );
}
