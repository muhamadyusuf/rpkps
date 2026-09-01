import { kamus } from "@/lib/bahasa/server";

/**
 * Kerangka halaman selagi data dimuat.
 *
 * Bentuknya sengaja meniru susunan halaman yang sesungguhnya — judul, sebaris
 * keterangan, lalu beberapa kartu — supaya tata letak tidak melompat saat isi
 * datang. Bukan pemintal berputar di tengah layar: yang itu tidak memberi tahu
 * apa pun tentang apa yang sedang datang.
 */
export async function KerangkaMuat({
  baris = 3,
  className,
}: {
  baris?: number;
  className?: string;
}) {
  const k = await kamus();

  return (
    <div className={className} aria-busy aria-label={k.komponen.muat.aria} role="status">
      <div className="animate-pulse space-y-6">
        <div className="space-y-2.5">
          <div className="h-3 w-24 rounded bg-muted/70" />
          <div className="h-7 w-64 max-w-full rounded bg-muted" />
          <div className="h-4 w-96 max-w-full rounded bg-muted/70" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: baris }, (_, i) => (
            <div key={i} className="panel space-y-2.5 rounded-lg border p-4">
              <div className="h-4 rounded bg-muted" style={{ width: `${45 + i * 12}%` }} />
              <div className="h-3 w-full rounded bg-muted/70" />
              <div className="h-3 rounded bg-muted/70" style={{ width: `${60 + i * 8}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
