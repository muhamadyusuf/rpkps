import type { Nada } from "@/domain/dasbor/ringkasan";
import { WARNA_NADA } from "./nada";

/**
 * Cincin kemajuan. Satu angka besar di tengah, satu keterangan di bawahnya —
 * dipakai untuk hal yang benar-benar berupa "sekian dari sekian", seperti
 * cakupan evaluasi. Jangan dipakai untuk membandingkan beberapa nilai;
 * mata manusia buruk membandingkan sudut. Untuk itu ada `BaganBatang`.
 */
export function Cincin({
  nilai,
  label,
  keterangan,
  nada = "cahaya",
  ukuran = 116,
}: {
  nilai: number;
  label: string;
  keterangan?: string;
  nada?: Nada;
  ukuran?: number;
}) {
  const tebal = 9;
  const r = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  const terisi = (Math.max(0, Math.min(100, nilai)) / 100) * keliling;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={ukuran}
        height={ukuran}
        viewBox={`0 0 ${ukuran} ${ukuran}`}
        role="img"
        aria-label={`${label}: ${nilai}%`}
      >
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={tebal}
        />
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke={WARNA_NADA[nada]}
          strokeWidth={tebal}
          strokeLinecap="round"
          strokeDasharray={`${terisi} ${keliling - terisi}`}
          transform={`rotate(-90 ${ukuran / 2} ${ukuran / 2})`}
          opacity={0.9}
        />
        <text
          x={ukuran / 2}
          y={ukuran / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={ukuran * 0.24}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fill="var(--foreground)"
        >
          {nilai}
        </text>
        <text
          x={ukuran / 2}
          y={ukuran / 2 + ukuran * 0.19}
          textAnchor="middle"
          fontSize={ukuran * 0.1}
          fontFamily="var(--font-mono)"
          fill="var(--muted-foreground)"
        >
          %
        </text>
      </svg>
      <div className="text-center">
        <p className="label-teknis text-muted-foreground/80">{label}</p>
        {keterangan ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
        ) : null}
      </div>
    </div>
  );
}
