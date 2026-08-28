import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WARNA_NADA } from "@/components/bagan";
import type { ButirAntrian } from "@/domain/dasbor/antrian";

/**
 * Antrian kerja — doc 07 §3.1.
 *
 * Satu daftar, terurut menurut kegentingan, dan hanya berisi hal yang
 * benar-benar menunggu pengguna ini. Kalau kosong, yang ditampilkan bukan
 * daftar kosong melainkan pernyataan bahwa tidak ada yang menunggu: itu
 * kabar, dan kabar itu pantas dibaca sekali lalu ditinggalkan.
 */
export function AntrianKerja({ butir }: { butir: readonly ButirAntrian[] }) {
  if (butir.length === 0) {
    return (
      <Card className="panel border-l-2 border-l-success bg-success/6">
        <CardContent className="flex items-center gap-3 py-4">
          <CircleCheck className="size-4 shrink-0 text-success-foreground" />
          <p className="text-sm text-muted-foreground">
            Tidak ada yang menunggu tindakan Anda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel siku overflow-hidden">
      <CardContent className="p-0">
        <ul className="divide-y divide-border/70">
          {butir.map((b) => (
            <li key={b.kunci}>
              <Link
                href={b.href}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-cahaya/5"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0"
                  style={{ color: WARNA_NADA[b.nada] }}
                >
                  {b.kegentingan === "TINGGI" ? (
                    <CircleAlert className="size-4" />
                  ) : b.kegentingan === "SEDANG" ? (
                    <TriangleAlert className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{b.judul}</span>
                    {b.jumlah > 1 ? (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        ×{b.jumlah}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {b.rincian}
                  </span>
                </span>

                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
