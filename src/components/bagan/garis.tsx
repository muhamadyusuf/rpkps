import { warnaDeret } from "./nada";

/**
 * Bagan garis untuk tren antar tahun akademik.
 *
 * Digambar sebagai SVG di server: tanpa pustaka grafik, tanpa JavaScript
 * klien. Dasbor ini kerap dibuka di jaringan kampus dan dicetak untuk rapat
 * mutu — keduanya alasan yang cukup untuk tidak mengirim runtime bagan.
 *
 * Titik `null` MEMUTUS garis, tidak diinterpolasi. Menarik garis lurus
 * melewati tahun yang tidak terukur akan mengarang tren yang tidak pernah
 * terjadi; putusnya garis justru menunjukkan lubang datanya.
 */

export interface DeretGaris {
  nama: string;
  titik: readonly (number | null)[];
  warna?: string;
}

const L = 640;
const T = 200;
const PAD = { kiri: 36, kanan: 10, atas: 12, bawah: 26 };

export function BaganGaris({
  deret,
  label,
  maks = 100,
  ambang,
  satuan = "%",
}: {
  deret: readonly DeretGaris[];
  label: readonly string[];
  maks?: number;
  ambang?: number;
  satuan?: string;
}) {
  if (label.length === 0 || deret.length === 0) return null;

  const lebar = L - PAD.kiri - PAD.kanan;
  const tinggi = T - PAD.atas - PAD.bawah;
  const x = (i: number) =>
    PAD.kiri + (label.length === 1 ? lebar / 2 : (i * lebar) / (label.length - 1));
  const y = (n: number) => PAD.atas + tinggi - (Math.max(0, Math.min(maks, n)) / maks) * tinggi;

  const garisBantu = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${L} ${T}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Tren ${deret.map((d) => d.nama).join(", ")} sepanjang ${label.join(", ")}`}
      >
        {garisBantu.map((g) => (
          <g key={g}>
            <line
              x1={PAD.kiri}
              x2={L - PAD.kanan}
              y1={PAD.atas + tinggi * (1 - g)}
              y2={PAD.atas + tinggi * (1 - g)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.kiri - 6}
              y={PAD.atas + tinggi * (1 - g) + 3.5}
              textAnchor="end"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="var(--muted-foreground)"
            >
              {Math.round(maks * g)}
            </text>
          </g>
        ))}

        {ambang !== undefined ? (
          <line
            x1={PAD.kiri}
            x2={L - PAD.kanan}
            y1={y(ambang)}
            y2={y(ambang)}
            stroke="var(--foreground)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}

        {deret.map((d, di) => {
          const warna = d.warna ?? warnaDeret(di);
          return (
            <g key={d.nama}>
              {potongan(d.titik).map((p, pi) =>
                p.length === 1 ? (
                  <circle
                    key={pi}
                    cx={x(p[0].i)}
                    cy={y(p[0].n)}
                    r={2.6}
                    fill={warna}
                  />
                ) : (
                  <polyline
                    key={pi}
                    points={p.map((t) => `${x(t.i)},${y(t.n)}`).join(" ")}
                    fill="none"
                    stroke={warna}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ),
              )}
              {d.titik.map((n, i) =>
                n === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(n)} r={2.2} fill={warna}>
                    <title>{`${d.nama} · ${label[i]} · ${n}${satuan}`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}

        {label.map((l, i) => (
          <text
            key={l}
            x={x(i)}
            y={T - 8}
            textAnchor={i === 0 ? "start" : i === label.length - 1 ? "end" : "middle"}
            fontSize={9}
            fontFamily="var(--font-mono)"
            fill="var(--muted-foreground)"
          >
            {l}
          </text>
        ))}
      </svg>

      {deret.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {deret.map((d, di) => (
            <li key={d.nama} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: d.warna ?? warnaDeret(di) }}
              />
              <span className="font-mono">{d.nama}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Memecah deret menjadi potongan-potongan yang bersambung, memisahkan null. */
function potongan(
  titik: readonly (number | null)[],
): { i: number; n: number }[][] {
  const hasil: { i: number; n: number }[][] = [];
  let kini: { i: number; n: number }[] = [];
  titik.forEach((n, i) => {
    if (n === null) {
      if (kini.length > 0) hasil.push(kini);
      kini = [];
    } else {
      kini.push({ i, n });
    }
  });
  if (kini.length > 0) hasil.push(kini);
  return hasil;
}
