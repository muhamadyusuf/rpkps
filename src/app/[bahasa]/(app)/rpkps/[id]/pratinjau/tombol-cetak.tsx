"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mencetak — atau, jauh lebih sering, menyimpan sebagai PDF lewat dialog cetak
 * peramban. Itulah cara halaman ini menghasilkan berkas PDF: tidak ada
 * penyusun PDF di server, dan tidak perlu ada, karena yang dirender di layar
 * sudah berupa lembar A4 dengan margin yang benar.
 *
 * Labelnya datang dari pemanggil: halaman ini memakai kamus antarmuka, dan
 * komponen klien tidak menerima kamus lewat `kamus()` yang hanya ada di
 * server.
 */
export function TombolCetak({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer />
      {label}
    </Button>
  );
}
