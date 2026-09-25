"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NAMA_COOKIE_REL, tulisRelCiut } from "@/lib/tata-letak/rel";
import { cn } from "@/lib/utils";
import { JamStatus } from "./jam";
import { PusatKontrol } from "./pusat-kontrol";
import { Sisi, type PropsSisi } from "./sisi";

/**
 * Bingkai halaman untuk pengguna yang sudah masuk — padanan `Cangkang`
 * identitas-itts (docs/28 §4).
 *
 * Keadaan ringkas dipegang DI KLIEN dan hanya dititipkan ke cookie
 * `rel_ciut`: mengubah lebar sidebar tidak mengubah satu pun data halaman,
 * jadi memaksanya lewat `router.refresh()` berarti membayar satu perjalanan
 * penuh ke server demi sesuatu yang seharusnya seketika. Cookie dibaca tata
 * letak server pada pemuatan BERIKUTNYA, supaya sidebar lahir pada lebar yang
 * benar alih-alih melebar sesaat lalu mengerut. Pintasan: ⌘\ / Ctrl+\.
 *
 * `data-rupa="aplikasi"` adalah saklar token (globals.css, docs/28 §3).
 */
export function Cangkang({
  ringkasAwal,
  children,
  ...sisi
}: PropsSisi & { ringkasAwal: boolean; children: ReactNode }) {
  const [ringkas, setRingkas] = useState(ringkasAwal);

  const alihRingkas = useCallback(() => {
    setRingkas((lama) => {
      const baru = !lama;
      document.cookie = `${NAMA_COOKIE_REL}=${tulisRelCiut(baru)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return baru;
    });
  }, []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== "\\" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      // Lajur ikon hanya ada di layar lebar (breakpoint `lg`).
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      e.preventDefault();
      alihRingkas();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [alihRingkas]);

  return (
    <div data-rupa="aplikasi" className="min-h-dvh">
      <Sisi {...sisi} ringkas={ringkas} alihRingkas={alihRingkas} />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out print:pl-0",
          ringkas ? "lg:pl-[68px]" : "lg:pl-[280px]",
        )}
      >
        {/* Bilah atas layar lebar (docs/28 §4.2): waktu + pusat kontrol di pojok
            kanan. TIDAK lengket — ia ikut tergulir bersama halaman, sehingga
            elemen `sticky top-6` di halaman tidak tertutup. Di bawah `lg`
            avatar yang sama ada di bilah atas milik `Sisi`. */}
        <div className="hidden h-14 items-center justify-end gap-3 border-b border-garis px-4 sm:px-8 lg:flex print:hidden">
          <JamStatus />
          <PusatKontrol
            identitas={sisi.identitas}
            aplikasi={sisi.aplikasi}
            urlIdentitas={sisi.urlIdentitas}
          />
        </div>
        <main className="min-w-0 px-4 pt-6 pb-16 sm:px-8 sm:pt-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
