"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBahasa } from "@/components/penyedia-bahasa";

export type ButirDaftarIsi = { id: string; label: string };

/**
 * Daftar isi yang menempel, dengan penanda bagian yang sedang dibaca.
 *
 * Memakai IntersectionObserver, bukan pendengar `scroll`: peramban yang
 * memberitahu ketika sebuah bagian masuk bidang pandang, jadi tidak ada
 * perhitungan posisi di setiap frame. `rootMargin` atas dibuat sepadan dengan
 * tinggi bilah yang menempel supaya judul yang tertutup bilah tidak dihitung
 * sebagai "sedang dibaca".
 *
 * Tanpa JavaScript daftar ini tetap berguna: isinya tautan jangkar biasa.
 */
export function DaftarIsi({ butir }: { butir: readonly ButirDaftarIsi[] }) {
  const [aktif, setAktif] = useState<string | null>(butir[0]?.id ?? null);
  const { k } = useBahasa();

  useEffect(() => {
    const bagian = butir
      .map((b) => document.getElementById(b.id))
      .filter((el): el is HTMLElement => el !== null);
    if (bagian.length === 0) return;

    const pengamat = new IntersectionObserver(
      (entri) => {
        const terlihat = entri
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (terlihat[0]) setAktif(terlihat[0].target.id);
      },
      { rootMargin: "-72px 0px -65% 0px", threshold: 0 },
    );

    for (const el of bagian) pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [butir]);

  return (
    <nav aria-label={k.dokumenPublik.daftarIsiAria} className="print:hidden">
      <p className="label-teknis mb-3 text-muted-foreground/70">
        {k.dokumenPublik.daftarIsiJudul}
      </p>
      <ul className="space-y-0.5 border-l border-border">
        {butir.map((b) => {
          const sedang = aktif === b.id;
          return (
            <li key={b.id}>
              <a
                href={`#${b.id}`}
                aria-current={sedang ? "location" : undefined}
                className={cn(
                  "relative -ml-px block border-l-2 py-1.5 pl-3 text-sm transition-all duration-200 ease-presisi",
                  sedang
                    ? "border-l-cahaya font-medium text-foreground"
                    : "border-l-transparent text-muted-foreground hover:border-l-border hover:text-foreground",
                )}
              >
                {b.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
