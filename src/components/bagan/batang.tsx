import type { Nada } from "@/domain/dasbor/ringkasan";
import { WARNA_NADA } from "./nada";

/**
 * Batang mendatar dengan penanda ambang.
 *
 * Digambar dengan kotak, bukan SVG: barisnya harus ikut melar mengikuti lebar
 * kolom tabel dan tetap terbaca saat halaman dicetak.
 *
 * `nilai: null` BUKAN nol. Nol berarti "diukur, hasilnya nol"; null berarti
 * "belum pernah diukur". Dua hal yang sama sekali berbeda pada laporan
 * capaian, dan digambar berbeda pula: batang kosong bergaris putus-putus.
 */

export interface BarisBatang {
  label: string;
  nilai: number | null;
  keterangan?: string;
  nada?: Nada;
  href?: string;
}

export function BaganBatang({
  data,
  maks = 100,
  ambang,
  satuan = "%",
  labelAmbang,
}: {
  data: readonly BarisBatang[];
  maks?: number;
  ambang?: number;
  satuan?: string;
  labelAmbang?: string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {ambang !== undefined ? (
        <p className="label-teknis text-muted-foreground/70">
          garis ambang {ambang}
          {satuan}
          {labelAmbang ? ` · ${labelAmbang}` : ""}
        </p>
      ) : null}

      {data.map((d) => {
        const kosong = d.nilai === null;
        const lebar = kosong ? 0 : Math.max(0, Math.min(100, (d.nilai! / maks) * 100));
        const warna = WARNA_NADA[d.nada ?? "cahaya"];

        return (
          <div key={d.label} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3">
            <span className="truncate font-mono text-xs" title={d.label}>
              {d.label}
            </span>

            <div className="relative h-5 overflow-hidden rounded-sm border border-border/70 bg-muted/50">
              {kosong ? (
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, var(--border) 0 1px, transparent 1px 7px)",
                  }}
                />
              ) : (
                <div
                  className="h-full rounded-r-[1px] transition-[width] duration-500 ease-presisi"
                  style={{ width: `${lebar}%`, backgroundColor: warna, opacity: 0.85 }}
                />
              )}

              {ambang !== undefined ? (
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-foreground/45"
                  style={{ left: `${Math.min(100, (ambang / maks) * 100)}%` }}
                />
              ) : null}
            </div>

            <span
              className={`text-right font-mono text-xs tabular-nums ${
                kosong ? "text-muted-foreground/60" : ""
              }`}
              title={d.keterangan}
            >
              {kosong ? "—" : `${d.nilai}${satuan}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
