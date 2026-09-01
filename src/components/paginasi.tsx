import { Tautan } from "@/components/tautan";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tautanHalaman, type Halaman } from "@/lib/paginasi";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import { cn } from "@/lib/utils";

/**
 * Navigasi halaman sebagai TAUTAN, bukan tombol berpenangan klik.
 *
 * Dengan begitu halaman daftar tetap dapat disalin, dibuka di tab baru, dan
 * bekerja tanpa JavaScript — sama seperti penyaring katalog publik. Nomor
 * halaman ikut ke alamat, sehingga "kirimkan saya halaman 3 daftar itu"
 * menjadi hal yang bisa dilakukan.
 */
export async function Paginasi({
  halaman,
  basis,
  params,
  satuan = "baris",
  className,
}: {
  halaman: Halaman;
  basis: string;
  params: Record<string, string | undefined>;
  /** Kunci satuan pada `kamus.komponen.satuan` — "baris", "pengguna", … */
  satuan?: keyof Kamus["komponen"]["satuan"];
  className?: string;
}) {
  if (halaman.total === 0) return null;

  const k = await kamus();

  const adaSebelum = halaman.halaman > 1;
  const adaSesudah = halaman.halaman < halaman.totalHalaman;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums">
        {isi(k.komponen.paginasi.menampilkan, {
          dari: halaman.dari,
          sampai: halaman.sampai,
          total: halaman.total,
          satuan: k.komponen.satuan[satuan],
        })}
      </p>

      {halaman.totalHalaman > 1 ? (
        <div className="flex items-center gap-1.5">
          <Anak
            href={tautanHalaman(basis, params, halaman.halaman - 1)}
            aktif={adaSebelum}
            label={k.komponen.paginasi.sebelumnya}
          >
            <ChevronLeft className="size-4" />
          </Anak>
          <span className="px-1 font-mono text-xs tabular-nums text-muted-foreground">
            {halaman.halaman} / {halaman.totalHalaman}
          </span>
          <Anak
            href={tautanHalaman(basis, params, halaman.halaman + 1)}
            aktif={adaSesudah}
            label={k.komponen.paginasi.berikutnya}
          >
            <ChevronRight className="size-4" />
          </Anak>
        </div>
      ) : null}
    </div>
  );
}

function Anak({
  href,
  aktif,
  label,
  children,
}: {
  href: string;
  aktif: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const rupa =
    "flex size-8 items-center justify-center rounded-lg border transition-colors";

  // Ujung daftar digambar sebagai <span>, bukan tautan mati: tautan yang
  // menuju halaman tak ada tetap dapat difokus dan tetap dapat diklik.
  if (!aktif) {
    return (
      <span aria-hidden className={cn(rupa, "border-border/60 text-muted-foreground/40")}>
        {children}
      </span>
    );
  }

  return (
    <Tautan
      href={href}
      aria-label={label}
      className={cn(rupa, "border-input bg-card hover:border-cahaya/35")}
    >
      {children}
    </Tautan>
  );
}
