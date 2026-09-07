"use client";

import { ChevronDown, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBahasa } from "@/components/penyedia-bahasa";
import { cn } from "@/lib/utils";

/**
 * Satu tombol unduh untuk dua bahasa berkas.
 *
 * Sebelumnya dua tombol berdampingan, dan keduanya mengambil dokumen yang
 * SAMA — hanya bahasanya yang berbeda. Dua tombol sejajar membuatnya terbaca
 * sebagai dua dokumen, dan barisan tombol di kepala halaman ikut memanjang
 * tiap kali bahasa baru ditambahkan. Sebagai menu, bahasanya menjadi apa
 * adanya: pilihan atas satu unduhan.
 *
 * Alamatnya `/api/…`, bukan halaman, jadi butirnya tautan `<a>` biasa —
 * `Tautan` tidak diperlukan (awalan bahasa memang tidak dipasang pada rute
 * API) dan `<a>` menjaga afordansi "buka di tab baru" yang wajar untuk
 * berkas.
 *
 * `basis` ditulis pemanggil tanpa kueri; komponen ini yang menambahkan
 * `?bahasa=`. Dengan begitu rute berwewenang (`/api/rpkps/…`) dan rute publik
 * (`/api/publik/rpkps/…`) memakai menu yang sama persis.
 */
export function TombolUnduh({
  basis,
  label,
  variant = "outline",
}: {
  basis: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const { k } = useBahasa();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant }))}>
        <Download />
        {label}
        <ChevronDown data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        {/*
          Kelompok, bukan sekadar judul yang melayang di atas dua butir. Base UI
          mengikat `Menu.GroupLabel` pada `Menu.Group` lewat konteks — dan yang
          menghubungkan keduanya untuk pembaca layar adalah `aria-labelledby`
          yang dipasang di sana. Tanpa pembungkusnya, judul ini bukan hanya
          kehilangan kaitan itu: komponennya melempar galat saat menu dibuka.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{k.dwibahasa.unduhBahasaLabel}</DropdownMenuLabel>
          <DropdownMenuLinkItem href={`${basis}?bahasa=id`}>
            <span>{k.dwibahasa.unduhId}</span>
            {/*
              Keterangan "naskah yang sah" menempel di sini, bukan di panel
              terpisah: inilah satu-satunya saat seseorang benar-benar memilih
              antara kedua berkas (docs/11 §7).
            */}
            <span className="ml-auto pl-3 text-xs text-muted-foreground">
              {k.dwibahasa.unduhIdCatatan}
            </span>
          </DropdownMenuLinkItem>
          <DropdownMenuLinkItem href={`${basis}?bahasa=en`}>
            {k.dwibahasa.unduhEn}
          </DropdownMenuLinkItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
