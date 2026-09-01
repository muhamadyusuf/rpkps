import { Tautan } from "@/components/tautan";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Potongan yang dipakai berulang oleh panel dasbor. Sengaja tipis: panel
 * yang berbeda peran harus tetap terlihat seperti satu halaman, bukan enam
 * halaman yang ditumpuk.
 */

export function Bagian({
  judul,
  keterangan,
  ikon,
  aksi,
  children,
}: {
  judul: string;
  keterangan?: string;
  ikon?: React.ReactNode;
  aksi?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-2.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            {ikon ? <span className="text-cahaya/80">{ikon}</span> : null}
            {judul}
          </h2>
          {keterangan ? (
            <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>
          ) : null}
        </div>
        {aksi ? (
          <Tautan
            href={aksi.href}
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {aksi.label}
            <ArrowRight className="size-3" />
          </Tautan>
        ) : null}
      </div>
      {children}
    </section>
  );
}

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
    <Card
      className={`panel h-full ${
        sorot ? "border-l-2 border-l-warning bg-warning/8" : ""
      } ${href ? "transition-colors hover:border-cahaya/40 hover:bg-cahaya/4" : ""}`}
    >
      <CardHeader className="pb-2">
        <CardDescription className="label-teknis flex items-center gap-1.5 text-muted-foreground/80">
          {ikon}
          {judul}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl leading-none font-semibold tabular-nums">
          {angka}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{keterangan}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Tautan href={href} className="block">
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
    <Card className={`panel ${className ?? ""}`}>
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
