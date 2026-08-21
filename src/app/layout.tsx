import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PenyediaTema } from "@/components/penyedia-tema";
import { urlSitus } from "@/lib/publik/tautan";
import "./globals.css";

/** Teks jalan: netral, lebar-x tinggi, nyaman untuk paragraf panjang. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/** Judul: geometris dengan potongan huruf yang khas — pembawa ciri khas. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

/** Angka, kode mata kuliah, dan label teknis: lebar tetap, mudah dibaris. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Diperlukan agar kartu OpenGraph dan tautan kanonik pada halaman publik
  // berupa URL absolut; tanpa ini pratinjau tautan menunjuk ke localhost.
  metadataBase: new URL(urlSitus()),
  title: {
    default: "RPKPS ITTS",
    template: "%s · RPKPS ITTS",
  },
  description:
    "Penyusunan Rencana Program dan Kegiatan Pembelajaran Semester berbasis OBE",
};

export const viewport: Viewport = {
  // Warna bilah peramban mengikuti kanvas masing-masing tema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101319" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <PenyediaTema>
          {children}
          <Toaster richColors position="top-center" />
        </PenyediaTema>
      </body>
    </html>
  );
}
