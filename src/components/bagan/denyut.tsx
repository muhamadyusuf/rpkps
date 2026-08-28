import type { TitikDenyut } from "@/domain/dasbor/ringkasan";

/**
 * Batang harian aktivitas. Skalanya relatif terhadap hari tersibuk pada
 * jendela yang sama — pertanyaannya "apakah masih ada yang bekerja", bukan
 * "berapa banyak persisnya".
 */
export function Denyut({ deret }: { deret: readonly TitikDenyut[] }) {
  const puncak = Math.max(1, ...deret.map((d) => d.jumlah));
  const total = deret.reduce((t, d) => t + d.jumlah, 0);

  return (
    <div className="space-y-2">
      <div
        className="flex h-16 items-end gap-[3px]"
        role="img"
        aria-label={`${total} kejadian dalam ${deret.length} hari terakhir`}
      >
        {deret.map((d) => (
          <div
            key={d.tanggal}
            title={`${d.tanggal}: ${d.jumlah}`}
            className="flex-1 rounded-t-[2px]"
            style={{
              height: `${Math.max(2, (d.jumlah / puncak) * 100)}%`,
              backgroundColor: d.jumlah === 0 ? "var(--border)" : "var(--cahaya)",
              opacity: d.jumlah === 0 ? 1 : 0.75,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{deret[0]?.tanggal.slice(5).replace("-", "/")}</span>
        <span>{total} kejadian</span>
        <span>{deret[deret.length - 1]?.tanggal.slice(5).replace("-", "/")}</span>
      </div>
    </div>
  );
}
