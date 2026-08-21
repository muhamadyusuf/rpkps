"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const PILIHAN = [
  { nilai: "system", label: "Sistem", ikon: Monitor },
  { nilai: "light", label: "Terang", ikon: Sun },
  { nilai: "dark", label: "Gelap", ikon: Moon },
] as const;

type Nilai = (typeof PILIHAN)[number]["nilai"];

/**
 * Tema tersimpan hanya diketahui di browser. Snapshot server mengembalikan
 * false sehingga markup awal identik dan hidrasi tidak bentrok.
 */
const tanpaLangganan = () => () => {};
function useTerpasang() {
  return useSyncExternalStore(
    tanpaLangganan,
    () => true,
    () => false,
  );
}

/**
 * Sakelar tiga posisi: penanda meluncur ke pilihan yang aktif, bertepi sian
 * tipis seperti tombol yang menyala. "Sistem" mengikuti mode gelap/terang
 * komputer pengguna.
 */
export function PengalihTema({
  className,
  tampilkanLabel = true,
}: {
  className?: string;
  tampilkanLabel?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const terpasang = useTerpasang();

  const aktif = (terpasang ? (theme as Nilai) : "system") ?? "system";
  const indeks = Math.max(
    0,
    PILIHAN.findIndex((p) => p.nilai === aktif),
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className={cn(
        "relative isolate grid grid-cols-3 rounded-lg border border-border bg-muted/60 p-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 -z-10 rounded-[calc(var(--radius)*0.7)] border border-cahaya/30 bg-card shadow-cahaya transition-transform duration-300 ease-presisi"
        style={{
          width: "calc((100% - 0.25rem) / 3)",
          transform: `translateX(calc(${indeks} * 100%))`,
          opacity: terpasang ? 1 : 0,
        }}
      />
      {PILIHAN.map(({ nilai, label, ikon: Ikon }) => {
        const dipilih = terpasang && aktif === nilai;
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={dipilih}
            title={label}
            onClick={() => setTheme(nilai)}
            className={cn(
              "flex h-7 items-center justify-center gap-1 rounded-[calc(var(--radius)*0.75)] px-1.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              dipilih
                ? "text-foreground [&_svg]:text-cahaya"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Ikon className="size-3.5 shrink-0" />
            {tampilkanLabel ? <span className="truncate">{label}</span> : null}
            {tampilkanLabel ? null : <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Varian ringkas untuk bilah atas ponsel: satu tombol yang berputar
 * Sistem → Terang → Gelap.
 */
export function TombolTema({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const terpasang = useTerpasang();

  const aktif = (terpasang ? (theme as Nilai) : "system") ?? "system";
  const indeks = Math.max(
    0,
    PILIHAN.findIndex((p) => p.nilai === aktif),
  );
  const berikutnya = PILIHAN[(indeks + 1) % PILIHAN.length];
  const Ikon = PILIHAN[indeks].ikon;

  return (
    <button
      type="button"
      onClick={() => setTheme(berikutnya.nilai)}
      title={`Tema: ${PILIHAN[indeks].label} — ketuk untuk ${berikutnya.label}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <Ikon className="size-4" />
      <span className="sr-only">Ubah tema (sekarang: {PILIHAN[indeks].label})</span>
    </button>
  );
}
