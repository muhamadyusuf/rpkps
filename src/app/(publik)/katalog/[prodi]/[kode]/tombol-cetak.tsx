"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mencetak halaman — atau menyimpannya sebagai PDF lewat dialog cetak
 * peramban. Halaman sudah punya aturan `@media print` sendiri, jadi hasilnya
 * dokumen bersih tanpa bilah, daftar isi, maupun tombol.
 */
export function TombolCetak() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer />
      Cetak / simpan PDF
    </Button>
  );
}
