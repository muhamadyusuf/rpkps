"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { BAHASA, type Bahasa } from "@/kamus";
import { pilihBahasa } from "@/lib/bahasa/aksi";
import { lepasAwalan } from "@/lib/bahasa/jalur";
import { cn } from "@/lib/utils";
import { useBahasa } from "@/components/penyedia-bahasa";

/**
 * Berpindah bahasa TANPA meninggalkan halaman.
 *
 * Alamatnya ditulis ulang di tempat — `/id/rpkps/abc` menjadi `/en/rpkps/abc`
 * — bukan dikembalikan ke dasbor. Mengganti bahasa lalu kehilangan halaman
 * yang sedang dibaca adalah cara tercepat membuat orang tidak pernah
 * mencobanya untuk kedua kali.
 *
 * Kueri ikut terbawa (saringan katalog, nomor halaman) dan dibaca dari
 * `window.location` di dalam penangan, bukan lewat `useSearchParams`: hook itu
 * menarik komponen ini ke batas Suspense terdekat dan ikut mendinamiskan
 * halaman katalog yang justru harus tetap statis.
 */
function usePindahBahasa() {
  const pathname = usePathname();
  const router = useRouter();
  const [menunggu, mulai] = useTransition();

  const pindah = (tujuan: Bahasa) =>
    mulai(async () => {
      await pilihBahasa(tujuan);
      const kueri = typeof window === "undefined" ? "" : window.location.search;
      const tanpa = lepasAwalan(pathname);
      router.replace(`/${tujuan}${tanpa === "/" ? "" : tanpa}${kueri}`);
      router.refresh();
    });

  return { menunggu, pindah };
}

/** Sakelar dua posisi untuk rel navigasi, sebentuk dengan `PengalihTema`. */
export function PengalihBahasa({ className }: { className?: string }) {
  const { bahasa, k } = useBahasa();
  const { menunggu, pindah } = usePindahBahasa();
  const indeks = Math.max(0, BAHASA.indexOf(bahasa));

  return (
    <div
      role="radiogroup"
      aria-label={k.bahasa.ganti}
      className={cn(
        "relative isolate grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5",
        menunggu && "opacity-70",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 -z-10 rounded-[calc(var(--radius)*0.7)] border border-cahaya/30 bg-card shadow-cahaya transition-transform duration-300 ease-presisi"
        style={{
          width: "calc((100% - 0.25rem) / 2)",
          transform: `translateX(calc(${indeks} * 100%))`,
        }}
      />
      {BAHASA.map((nilai) => {
        const dipilih = bahasa === nilai;
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={dipilih}
            disabled={menunggu}
            onClick={() => !dipilih && pindah(nilai)}
            className={cn(
              "flex h-7 items-center justify-center gap-1 rounded-[calc(var(--radius)*0.75)] px-1.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              dipilih
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* Nama bahasa ditulis dalam bahasa ITU SENDIRI di kedua kamus,
                supaya orang yang tersesat di bahasa yang tidak ia mengerti
                tetap mengenali jalan pulang. */}
            <span className="truncate">{nilai === "id" ? k.bahasa.id : k.bahasa.en}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Varian ringkas untuk bilah atas ponsel: satu tombol yang berganti-ganti. */
export function TombolBahasa({ className }: { className?: string }) {
  const { bahasa, k } = useBahasa();
  const { menunggu, pindah } = usePindahBahasa();
  const berikutnya = BAHASA[(BAHASA.indexOf(bahasa) + 1) % BAHASA.length];

  return (
    <button
      type="button"
      disabled={menunggu}
      onClick={() => pindah(berikutnya)}
      title={k.bahasa.ganti}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <Languages className="size-4" />
      <span className="sr-only">
        {k.bahasa.ganti} — {bahasa.toUpperCase()}
      </span>
    </button>
  );
}
