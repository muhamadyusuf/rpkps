"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBahasa } from "@/components/penyedia-bahasa";

/**
 * Label diambil dari kamus lewat `kunci`, bukan ditulis di sini: daftar ini
 * adalah konstanta modul, sedangkan bahasanya baru diketahui saat render.
 */
const PILIHAN = [
  { nilai: "system", kunci: "sistem", ikon: Monitor },
  { nilai: "light", kunci: "terang", ikon: Sun },
  { nilai: "dark", kunci: "gelap", ikon: Moon },
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
  const { k } = useBahasa();

  const aktif = (terpasang ? (theme as Nilai) : "system") ?? "system";
  const indeks = Math.max(
    0,
    PILIHAN.findIndex((p) => p.nilai === aktif),
  );

  return (
    <div
      role="radiogroup"
      aria-label={k.komponen.tema.aria}
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
      {PILIHAN.map(({ nilai, kunci, ikon: Ikon }) => {
        const label = k.komponen.tema[kunci];
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
  const { k, isi } = useBahasa();

  const aktif = (terpasang ? (theme as Nilai) : "system") ?? "system";
  const indeks = Math.max(
    0,
    PILIHAN.findIndex((p) => p.nilai === aktif),
  );
  const berikutnya = PILIHAN[(indeks + 1) % PILIHAN.length];
  const Ikon = PILIHAN[indeks].ikon;
  const sekarang = k.komponen.tema[PILIHAN[indeks].kunci];

  return (
    <button
      type="button"
      onClick={() => setTheme(berikutnya.nilai)}
      title={isi(k.komponen.tema.petunjuk, {
        sekarang,
        berikutnya: k.komponen.tema[berikutnya.kunci],
      })}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <Ikon className="size-4" />
      <span className="sr-only">{isi(k.komponen.tema.ubah, { sekarang })}</span>
    </button>
  );
}
