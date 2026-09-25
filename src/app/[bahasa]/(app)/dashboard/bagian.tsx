import { Tautan } from "@/components/tautan";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Potongan yang dipakai berulang oleh panel dasbor. Sengaja tipis: panel
 * yang berbeda peran harus tetap terlihat seperti satu halaman, bukan enam
 * halaman yang ditumpuk.
 */

/**
 * Bagian bergaya `Bagian` identitas-itts (docs/28 §5): judul 15px yang
 * didahului nomor monospace "01/02/…", tautan aksi di kanan. Nomornya dari
 * halaman — urutan bagian bergantung pada peran yang dipegang.
 */
export function Bagian({
  judul,
  keterangan,
  ikon,
  aksi,
  nomor,
  children,
}: {
  judul: string;
  keterangan?: string;
  ikon?: React.ReactNode;
  aksi?: { href: string; label: string };
  nomor?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2.5 text-[15px] font-semibold tracking-tight">
            {nomor ? (
              <span className="font-mono text-[11px] font-normal text-muted-foreground/80">
                {nomor}
              </span>
            ) : null}
            {ikon ? <span className="self-center text-muted-foreground/80">{ikon}</span> : null}
            {judul}
          </h2>
          {keterangan ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{keterangan}</p>
          ) : null}
        </div>
        {aksi ? (
          <Tautan
            href={aksi.href}
            className="flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            {aksi.label}
            <ArrowRight className="size-3.5" />
          </Tautan>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Kartu angka bergaya `Statistik` identitas-itts: label mikro + ikon di atas,
 * angka monospace 32px di bawah. `sorot` = tepi sinyal (butuh perhatian).
 */
export function KartuAngka({
  judul,
  angka,
  keterangan,
  href,
  sorot,
  ikon,
}: {
  judul: string;
  angka: string | number;
  keterangan: string;
  href?: string;
  sorot?: boolean;
  ikon?: React.ReactNode;
}) {
  const isi = (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-6 rounded-xl border bg-card p-4 shadow-angkat-sm transition-[border-color,box-shadow] sm:p-5",
        sorot ? "border-warning/40" : "border-border",
        href && (sorot ? "hover:border-warning hover:shadow-angkat" : "hover:border-input hover:shadow-angkat"),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-teknis">{judul}</span>
        {ikon ? (
          <span className={cn("[&_svg]:size-[15px]", sorot ? "text-warning" : "text-muted-foreground/70")}>
            {ikon}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[32px] leading-none font-medium tracking-[-0.04em] tabular-nums">
          {angka}
        </p>
        <p className="mt-2 truncate text-xs text-muted-foreground">{keterangan}</p>
      </div>
    </div>
  );

  return href ? (
    <Tautan href={href} className="block h-full">
      {isi}
    </Tautan>
  ) : (
    isi
  );
}

export function Panel({
  judul,
  keterangan,
  children,
  className,
}: {
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{judul}</CardTitle>
        {keterangan ? <CardDescription>{keterangan}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Kosong({ pesan }: { pesan: string }) {
  return (
    <p className="rounded-md border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
      {pesan}
    </p>
  );
}
