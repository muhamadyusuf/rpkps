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
      {/* Tepi kanan rel adalah satu garis rata, sama seperti bilah halaman
        depan — dulu ada pendar yang meluruh dari atas ke bawah, dan pada palet
        kertas pendar itu terbaca sebagai noda, bukan sebagai cahaya.

        `print:hidden` di atas, bukan per halaman: sejak ada pratinjau dokumen,
        halaman aplikasi ikut dicetak dan disimpan sebagai PDF — dan yang
        dicetak harus dokumennya, bukan antarmukanya. Aturan `@media print`
        selebihnya ada di globals.css. */}

      {/*
        Sakelar lebar berbagi baris dengan lambang, di kepala rel — tempat
        pengguna mencarinya lebih dulu. Ia selalu berupa ikon saja: labelnya
        sudah ada pada `aria-label` dan tooltip, dan teks di sini akan
        menyaingi nama aplikasi di sebelahnya.

        Pada rel selebar ikon tidak ada dua tempat: 64px tidak memuat lambang
        dan tombol berdampingan. Karena itu keduanya menjadi SATU tombol —
        lambang yang berubah menjadi ikon "lebarkan" saat disorot atau
        difokus. Pergantiannya hanya opasitas di atas tumpukan yang sama,
        jadi tidak ada yang bergeser saat kursor lewat.
      */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          ciut ? "justify-center px-2" : "gap-2 px-3",
        )}
      >
        {ciut ? null : <TandaAplikasi />}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={alihkan}
                aria-expanded={!ciut}
                aria-label={ciut ? k.kerangka.lebarkan : k.kerangka.ciutkan}
                className={cn(
                  "group relative flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  ciut ? "" : "ml-auto",
                )}
              />
            }
          >
            {ciut ? (
              <>
                <Lambang className="size-7 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0" />
                <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </>
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {ciut ? k.kerangka.lebarkan : k.kerangka.ciutkan}
          </TooltipContent>
        </Tooltip>
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

            <div className="rounded-md border border-border bg-card px-3 py-2.5">
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
