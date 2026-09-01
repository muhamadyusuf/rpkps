import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PenyediaTema } from "@/components/penyedia-tema";
import { PenyediaBahasa } from "@/components/penyedia-bahasa";
import { BAHASA, adalahBahasa, kamusUntuk } from "@/kamus";
import { kamus } from "@/lib/bahasa/server";
import { urlSitus } from "@/lib/publik/tautan";
import "../globals.css";

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

/**
 * Kedua bahasa diterbitkan sebagai ruas statis supaya katalog publik tetap
 * dapat dirender di muka. Tanpa ini, satu-satunya bagian aplikasi yang dibaca
 * mesin pencari kehilangan cache-nya.
 */
export function generateStaticParams() {
  return BAHASA.map((bahasa) => ({ bahasa }));
}

export async function generateMetadata(): Promise<Metadata> {
  const k = await kamus();
  return {
    // Diperlukan agar kartu OpenGraph dan tautan kanonik pada halaman publik
    // berupa URL absolut; tanpa ini pratinjau tautan menunjuk ke localhost.
    metadataBase: new URL(urlSitus()),
    title: {
      default: k.aplikasi.nama,
      template: k.aplikasi.templatJudul,
    },
    description: k.aplikasi.deskripsi,
  };
}

export const viewport: Viewport = {
  // Warna bilah peramban mengikuti kanvas masing-masing tema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101319" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ bahasa: string }>;
}>) {
  const { bahasa } = await params;

  // Proxy sudah menyaring ruas bahasa sebelum permintaan sampai ke sini, tapi
  // rendering statis dan pemanggilan langsung tidak lewat proxy. 404 jauh
  // lebih baik daripada diam-diam jatuh ke bahasa bawaan: alamat asing yang
  // menghasilkan halaman sah akan terindeks mesin pencari sebagai duplikat.
  if (!adalahBahasa(bahasa)) notFound();

  return (
    <html
      lang={bahasa}
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <PenyediaBahasa bahasa={bahasa} kamus={kamusUntuk(bahasa)}>
          <PenyediaTema>
            {children}
            <Toaster richColors closeButton position="top-center" />
          </PenyediaTema>
        </PenyediaBahasa>
      </body>
    </html>
  );
}
