"use client";

import { useCallback, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Peran } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavigasiSamping } from "@/components/navigasi";
import { Lambang, TandaAplikasi } from "@/components/lambang";
import { PengalihBahasa, TombolBahasa } from "@/components/pengalih-bahasa";
import { PengalihTema, TombolTema } from "@/components/pengalih-tema";
import { TombolKeluar } from "@/components/tombol-keluar";
import { useBahasa } from "@/components/penyedia-bahasa";
import type { ButirMenu } from "@/lib/menu";
import { NAMA_COOKIE_REL, tulisRelCiut } from "@/lib/tata-letak/rel";
import { cn } from "@/lib/utils";

/**
 * Rel kiri, dengan dua lebar: penuh, atau selebar ikon.
 *
 * Keadaannya dipegang DI SISI KLIEN dan hanya dititipkan ke cookie. Mengubah
 * lebar rel tidak mengubah satu pun data halaman, jadi memaksanya lewat
 * `router.refresh()` berarti membayar satu perjalanan penuh ke server —
 * termasuk hitung notifikasi — demi sesuatu yang seharusnya seketika. Cookie
 * hanya dibaca pada pemuatan BERIKUTNYA, oleh tata letak di server, supaya rel
 * lahir pada lebar yang benar alih-alih melebar sesaat lalu mengerut.
 *
 * Karena nilai awalnya datang dari server dan keadaan awal klien disemai dari
 * nilai yang sama, tidak ada ketidakcocokan hidrasi.
 */
export function RelSamping({
  ciutAwal,
  menu,
  identitas,
}: {
  ciutAwal: boolean;
  menu: readonly ButirMenu[];
  identitas: { nama: string; email: string; peran: readonly Peran[] };
}) {
  const [ciut, setCiut] = useState(ciutAwal);
  const { k } = useBahasa();

  const alihkan = useCallback(() => {
    setCiut((sebelumnya) => {
      const berikutnya = !sebelumnya;
      document.cookie = `${NAMA_COOKIE_REL}=${tulisRelCiut(berikutnya)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return berikutnya;
    });
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-presisi md:flex print:hidden",
        ciut ? "w-16" : "w-64",
      )}
    >
      {/* Rel kiri. Tepi kanannya bukan garis rata: ada pendar sian yang
        meluruh dari atas ke bawah, menandai rel sebagai sisi "instrumen".

        `print:hidden` di atas, bukan per halaman: sejak ada pratinjau dokumen,
        halaman aplikasi ikut dicetak dan disimpan sebagai PDF — dan yang
        dicetak harus dokumennya, bukan antarmukanya. Aturan `@media print`
        selebihnya ada di globals.css. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -right-px w-px bg-[linear-gradient(180deg,var(--cahaya),transparent_45%)] opacity-30"
      />

      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border",
          ciut ? "justify-center px-2" : "gap-2 px-4",
        )}
      >
        {ciut ? <Lambang className="size-7" /> : <TandaAplikasi />}
      </div>

      <NavigasiSamping menu={menu} ciut={ciut} />

      <div
        className={cn(
          "shrink-0 space-y-3 border-t border-sidebar-border",
          ciut ? "flex flex-col items-center gap-1 space-y-0 p-2" : "p-2.5",
        )}
      >
        {ciut ? (
          <>
            {/*
              Sakelar dua dan tiga posisi tidak muat pada rel selebar ikon.
              Varian ringkasnya sudah ada — dipakai bilah ponsel — dan
              keduanya berputar lewat pilihan yang sama, jadi tidak ada
              pengaturan yang hilang, hanya bentuknya yang berubah.
            */}
            <TombolBahasa />
            <TombolTema />
            <InisialPengguna identitas={identitas} />
            <TombolKeluar tampilkanLabel={false} />
          </>
        ) : (
          <>
            <PengalihBahasa />
            <PengalihTema />

            <div className="panel rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="label-teknis mb-1.5 text-muted-foreground/70">
                {k.kerangka.sesi}
              </p>
              <p className="truncate text-sm font-medium">{identitas.nama}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {identitas.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {identitas.peran.length > 0 ? (
                  identitas.peran.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {k.enum.peran[p]}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {k.kerangka.tanpaPeran}
                  </Badge>
                )}
              </div>
            </div>

            <TombolKeluar className="w-full justify-start" />
          </>
        )}

        {/*
          Sakelar lebar di kaki rel, bukan di kepalanya: kepala rel adalah
          tempat lambang, dan tombol yang berbagi baris dengannya terbaca
          seperti bagian dari lambang itu. Di kaki, ia berada di antara
          pengaturan tampilan lain — di mana memang tempatnya.
        */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={alihkan}
                aria-expanded={!ciut}
                aria-label={ciut ? k.kerangka.lebarkan : k.kerangka.ciutkan}
                className={cn(
                  "flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  ciut
                    ? "size-9 justify-center"
                    : "w-full gap-2 px-2.5 py-1.5 text-xs",
                )}
              />
            }
          >
            {ciut ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4 shrink-0" />
                <span className="truncate">{k.kerangka.ciutkan}</span>
              </>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {ciut ? k.kerangka.lebarkan : k.kerangka.ciutkan}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

/**
 * Kartu sesi tidak muat pada rel ciut, tetapi "sedang masuk sebagai siapa"
 * tidak boleh hilang sama sekali — aplikasi ini dibuka bergantian di komputer
 * lab. Inisial beserta penjelasnya menjawab pertanyaan itu tanpa satu baris
 * teks pun.
 */
function InisialPengguna({
  identitas,
}: {
  identitas: { nama: string; email: string };
}) {
  const inisial = identitas.nama
    .split(/\s+/)
    .filter((bagian) => /\p{L}/u.test(bagian))
    .slice(0, 2)
    .map((bagian) => bagian[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card font-mono text-[11px] font-semibold text-muted-foreground"
            aria-label={`${identitas.nama} · ${identitas.email}`}
          />
        }
      >
        {inisial || "?"}
      </TooltipTrigger>
      <TooltipContent side="right">
        <span className="block font-medium">{identitas.nama}</span>
        <span className="block font-mono text-[11px] opacity-80">
          {identitas.email}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
