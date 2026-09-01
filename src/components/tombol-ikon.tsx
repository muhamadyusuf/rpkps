"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Aksi bergambar dengan penjelasnya.
 *
 * Ikon tanpa teks selalu menuntut tebakan — palang berarti hapus atau tutup?
 * panah ke bawah berarti geser atau unduh? — dan tebakan yang salah di halaman
 * ini berakibat pada dokumen, bukan pada tampilan. Karena itu setiap aksi
 * bergambar di aplikasi ini lewat komponen ini, yang memaksa penjelasnya ada.
 *
 * `petunjuk` juga menjadi `aria-label`, sehingga yang terbaca pembaca layar
 * persis sama dengan yang terbaca pengguna lain — bukan dua kalimat berbeda
 * yang lambat laun tidak lagi sejalan.
 */
export function TombolIkon({
  petunjuk,
  petunjukMati,
  disabled,
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button> & {
  petunjuk: string;
  /**
   * Penjelas saat tombol mati. Menjawab pertanyaan yang justru paling sering
   * muncul — "kenapa ini tidak bisa ditekan?" — yang tidak terjawab oleh
   * tombol kelabu tanpa keterangan.
   */
  petunjukMati?: string;
}) {
  const teks = disabled ? (petunjukMati ?? petunjuk) : petunjuk;

  return (
    <Tooltip>
      {/*
        Pemicunya SEBUAH SPAN yang membungkus tombol, bukan tombolnya sendiri:
        peramban tidak mengirim peristiwa tetikus dari elemen `disabled`, jadi
        penjelas pada tombol mati tidak akan pernah muncul — padahal justru itu
        yang paling dibutuhkan.
      */}
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          variant={variant}
          size={size}
          aria-label={teks}
          disabled={disabled}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{teks}</TooltipContent>
    </Tooltip>
  );
}

/** Padanan `TombolIkon` untuk perpindahan halaman; tetap sebuah tautan. */
export function TautanIkon({
  petunjuk,
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof ButtonLink> & { petunjuk: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ButtonLink variant={variant} size={size} aria-label={petunjuk} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{petunjuk}</TooltipContent>
    </Tooltip>
  );
}
