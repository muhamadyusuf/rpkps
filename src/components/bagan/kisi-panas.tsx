/**
 * Kisi panas: baris × kolom, satu angka per sel.
 *
 * Dipakai untuk CPL × tahun akademik dan prodi × indikator. Sel `null`
 * digambar bergaris, bukan pucat — pucat terbaca sebagai "nilainya rendah",
 * padahal artinya "tidak diukur".
 */
export function KisiPanas({
  kolom,
  baris,
  ambang,
  satuan = "%",
}: {
  kolom: readonly string[];
  baris: readonly { label: string; keterangan?: string; sel: readonly (number | null)[] }[];
  /** Sel di bawah ambang diberi rona peringatan alih-alih rona cahaya. */
  ambang?: number;
  satuan?: string;
}) {
  if (baris.length === 0 || kolom.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="w-28 px-1 text-left font-normal text-muted-foreground/80" />
            {kolom.map((k) => (
              <th
                key={k}
                className="label-teknis px-1 pb-1 text-center font-normal text-muted-foreground/70"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.label}>
              <th
                scope="row"
                className="truncate px-1 text-left font-mono text-[11px] font-normal"
                title={b.keterangan ?? b.label}
              >
                {b.label}
              </th>
              {b.sel.map((n, i) => {
                const kosong = n === null;
                const dibawah = ambang !== undefined && !kosong && n! < ambang;
                const kuat = kosong ? 0 : Math.max(0.08, Math.min(1, n! / 100));
                return (
                  <td
                    key={`${b.label}-${kolom[i] ?? i}`}
                    title={`${b.label} · ${kolom[i]} · ${kosong ? "tidak terukur" : `${n}${satuan}`}`}
                    className="h-8 rounded-[3px] text-center font-mono tabular-nums"
                    style={
                      kosong
                        ? {
                            backgroundImage:
                              "repeating-linear-gradient(135deg, var(--border) 0 1px, transparent 1px 7px)",
                            color: "var(--muted-foreground)",
                          }
                        : {
                            backgroundColor: dibawah
                              ? "var(--warning)"
                              : "var(--cahaya)",
                            opacity: 0.18 + kuat * 0.62,
                          }
                    }
                  >
                    {kosong ? "·" : n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
