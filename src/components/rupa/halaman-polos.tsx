import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PengaturanTampilan } from "./tampilan";

/**
 * Bingkai halaman tanpa sidebar — masuk, menunggu verifikasi, setup
 * (docs/28 §6). Latar netral, sakelar tampilan di pojok kanan atas, isi di
 * tengah. `data-rupa="aplikasi"` memasang token yang sama dengan kerangka
 * aplikasi, jadi halaman sebelum dan sesudah masuk tampak satu produk.
 */
export function HalamanPolos({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-rupa="aplikasi" className="relative flex min-h-dvh flex-col">
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <PengaturanTampilan />
      </div>
      <main className={cn("flex flex-1 flex-col items-center px-4 pb-12", className)}>
        {children}
      </main>
    </div>
  );
}
