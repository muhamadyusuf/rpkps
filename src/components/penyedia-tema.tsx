"use client";

import { ThemeProvider } from "next-themes";

/**
 * Rupa "Kisi & Cahaya" disusun gelap lebih dulu, jadi gelap yang jadi bawaan.
 * Pengguna tetap bebas memilih Sistem / Terang / Gelap lewat PengalihTema, dan
 * pilihannya disimpan di localStorage sehingga menang atas bawaan ini.
 */
export function PenyediaTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
