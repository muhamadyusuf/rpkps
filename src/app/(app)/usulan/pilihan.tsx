"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `<select>` bawaan peramban yang disamakan tampilannya dengan Input.
 *
 * Sengaja bukan komponen Select milik Base UI: formulir usulan dikirim lewat
 * server action dengan FormData, dan `<select>` bawaan ikut terkirim tanpa
 * perlu state tambahan. Panah digambar sendiri karena `appearance-none`
 * menghapus panah asli.
 */
export function Pilihan({
  id,
  nama,
  nilai,
  onChange,
  children,
  className,
}: {
  id: string;
  nama: string;
  nilai?: string;
  onChange?: (nilai: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        name={nama}
        defaultValue={onChange ? undefined : nilai}
        value={onChange ? nilai : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-card py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,border-color] duration-200 outline-none",
          "hover:border-cahaya/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
          "dark:bg-input/30",
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute top-1/2 right-3 h-1.5 w-2.5 -translate-y-1/2 text-muted-foreground"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function AreaTeks({
  id,
  nama,
  nilai,
  onChange,
  baris = 3,
  placeholder,
}: {
  id: string;
  nama: string;
  nilai?: string;
  onChange?: (nilai: string) => void;
  baris?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      name={nama}
      rows={baris}
      defaultValue={onChange ? undefined : nilai}
      value={onChange ? nilai : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
    />
  );
}
