"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { BAHASA } from "@/kamus";
import { useBahasa } from "@/components/penyedia-bahasa";
import { usePindahBahasa } from "@/components/pengalih-bahasa";
import { cn } from "@/lib/utils";

const TEMA = [
  { nilai: "light", kunci: "terang", ikon: Sun },
  { nilai: "dark", kunci: "gelap", ikon: Moon },
  { nilai: "system", kunci: "sistem", ikon: Monitor },
] as const;

/** Tema tersimpan hanya diketahui di peramban; server merender "belum tahu". */
const tanpaLangganan = () => () => {};
function useTerpasang() {
  return useSyncExternalStore(
    tanpaLangganan,
    () => true,
    () => false,
  );
}

/**
 * Sakelar tampilan di kaki sidebar — bentuk `PengaturanTampilan`
 * identitas-itts (tiga ikon tema + ID/EN), logika pengalih RPKPS yang sudah
 * ada: `next-themes` untuk tema, `usePindahBahasa` yang menulis ulang alamat
 * di tempat untuk bahasa.
 */
export function PengaturanTampilan({ tegak = false }: { tegak?: boolean }) {
  const { theme, setTheme } = useTheme();
  const terpasang = useTerpasang();
  const { bahasa, k } = useBahasa();
  const { menunggu, pindah } = usePindahBahasa();
  const temaAktif = terpasang ? (theme ?? "system") : null;

  const kelompok = cn(
    "flex rounded-lg border border-garis bg-permukaan-2 p-0.5",
    tegak && "flex-col",
  );
  const butir = (aktif: boolean) =>
    cn(
      "flex h-7 items-center justify-center rounded-md text-[11.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      aktif ? "bg-permukaan text-teks shadow-b1" : "text-teks-3 hover:text-teks",
    );

  return (
    <div className={cn("flex items-center gap-2", tegak ? "flex-col" : "justify-between")}>
      <div role="radiogroup" aria-label={k.komponen.tema.aria} className={kelompok}>
        {TEMA.map(({ nilai, kunci, ikon: Ikon }) => {
          const label = k.komponen.tema[kunci];
          return (
            <button
              key={nilai}
              type="button"
              role="radio"
              aria-checked={temaAktif === nilai}
              aria-label={label}
              title={label}
              onClick={() => setTheme(nilai)}
              className={cn(butir(temaAktif === nilai), "w-8")}
            >
              <Ikon aria-hidden className="size-[15px]" />
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={k.bahasa.ganti}
        className={cn(kelompok, menunggu && "opacity-70")}
      >
        {BAHASA.map((nilai) => (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={bahasa === nilai}
            disabled={menunggu}
            // Nama bahasa ditulis dalam bahasa ITU SENDIRI di kedua kamus.
            title={nilai === "id" ? k.bahasa.id : k.bahasa.en}
            onClick={() => bahasa !== nilai && pindah(nilai)}
            className={cn(butir(bahasa === nilai), "w-8 font-mono uppercase")}
          >
            {nilai}
          </button>
        ))}
      </div>
    </div>
  );
}
