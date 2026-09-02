import type { Segmen } from "@/domain/dasbor/ringkasan";
import { WARNA_NADA } from "./nada";

/**
 * Satu batang tumpuk dengan legenda — dipakai untuk corong status
 * (Draf → Diajukan → Terbit).
 *
 * Segmen bernilai nol dibuang dari batang tetapi DIPERTAHANKAN di legenda:
 * "tidak ada satu pun yang terbit" adalah kabar yang paling perlu terbaca,
 * dan ia hilang kalau segmennya sekadar tidak digambar.
 */
export function BaganTumpuk({
  segmen,
  sisa,
  tanpaData,
}: {
  segmen: readonly Segmen[];
  /** Bagian yang belum tercakup sama sekali, mis. MK yang belum punya RPKPS. */
  sisa?: { label: string; jumlah: number };
  /**
   * Teks saat tidak ada data. Dioper, bukan diambil dari kamus di sini:
   * bagan ini komponen server tanpa `use client`, dipakai dari beberapa panel,
   * dan menariknya ke kamus akan memaksa seluruh pemakainya menjadi async.
   */
  tanpaData: string;
}) {
  const daftar = [
    ...segmen,
    ...(sisa && sisa.jumlah > 0
      ? [{ kunci: "__sisa", label: sisa.label, jumlah: sisa.jumlah, nada: "netral" as const }]
      : []),
  ];
  const total = daftar.reduce((t, s) => t + s.jumlah, 0);

  return (
    <div className="space-y-3">
      <div
        className="flex h-7 overflow-hidden rounded-md border border-border/70 bg-muted/40"
        role="img"
        aria-label={daftar.map((s) => `${s.label}: ${s.jumlah}`).join(", ")}
      >
        {total === 0 ? (
          <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
            {tanpaData}
          </div>
        ) : (
          daftar
            .filter((s) => s.jumlah > 0)
            .map((s) => (
              <div
                key={s.kunci}
                title={`${s.label}: ${s.jumlah}`}
                className="flex items-center justify-center overflow-hidden border-r border-background/40 text-[11px] font-medium last:border-r-0"
                style={{
                  width: `${(s.jumlah / total) * 100}%`,
                  backgroundColor: WARNA_NADA[s.nada],
                  opacity: s.kunci === "__sisa" ? 0.25 : 0.8,
                }}
              >
                <span className="px-1 font-mono tabular-nums text-background">
                  {(s.jumlah / total) * 100 >= 8 ? s.jumlah : ""}
                </span>
              </div>
            ))
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {daftar.map((s) => (
          <li key={s.kunci} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: WARNA_NADA[s.nada],
                opacity: s.jumlah === 0 ? 0.3 : 0.85,
              }}
            />
            <span className={s.jumlah === 0 ? "text-muted-foreground/70" : ""}>
              {s.label}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{s.jumlah}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
