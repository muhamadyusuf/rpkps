import Link from "next/link";
import { ArrowUpRight, LogIn } from "lucide-react";
import { TandaAplikasi } from "@/components/lambang";
import { TombolTema } from "@/components/pengalih-tema";
import { ButtonLink } from "@/components/ui/button";
import { daftarProdiPublik, muatInstitusi } from "@/lib/publik/muat";
import { situsProdi } from "@/lib/publik/tautan";
import { NavigasiPublik } from "./navigasi-publik";

/**
 * Kerangka halaman publik.
 *
 * Sengaja berbeda dari layout aplikasi: tanpa rel samping, satu bilah atas
 * yang ramping, dan ruang yang lebih longgar. Pembaca di sini datang dari
 * tautan luar dan hanya membaca satu dokumen — bukan berpindah antar modul.
 * Rupa tetap "Kisi & Cahaya"; kisi dan pendar sian sudah dipasang global di
 * `body::before/::after`.
 */
export default async function LayoutPublik({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prodi, institusi] = await Promise.all([
    daftarProdiPublik(),
    muatInstitusi(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="material sticky top-0 z-40 border-b print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <Link href="/" className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
            <TandaAplikasi />
          </Link>

          <NavigasiPublik className="ml-2 hidden sm:flex" />

          <div className="ml-auto flex items-center gap-1">
            <TombolTema />
            <ButtonLink variant="outline" size="sm" href="/dashboard">
              <LogIn />
              <span className="hidden sm:inline">Masuk</span>
            </ButtonLink>
          </div>
        </div>

        {/* Pada ponsel navigasi turun satu baris agar lambang dan tombol
            Masuk tidak berdesakan di bilah yang sama. */}
        <NavigasiPublik className="border-t px-3 py-1.5 sm:hidden" />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        {children}
      </main>

      <footer className="panel mt-8 border-t print:hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
          <div>
            <TandaAplikasi />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Katalog Rencana Program dan Kegiatan Pembelajaran Semester{" "}
              {institusi.nama}, disusun dengan pendekatan Outcome-Based
              Education.
            </p>
          </div>

          <div>
            <p className="label-teknis mb-3 text-muted-foreground/70">
              Program Studi
            </p>
            <ul className="space-y-1.5 text-sm">
              {prodi.map((p) => (
                <li key={p.kode}>
                  <Link
                    href={`/katalog/${p.kode.toLowerCase()}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p.nama}
                  </Link>
                </li>
              ))}
              {prodi.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  Belum ada program studi dengan dokumen terbit.
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="label-teknis mb-3 text-muted-foreground/70">Tautan</p>
            <ul className="space-y-1.5 text-sm">
              {prodi
                .map((p) => ({ p, situs: situsProdi(p.kode) }))
                .filter((x): x is { p: (typeof prodi)[number]; situs: string } =>
                  Boolean(x.situs),
                )
                .map(({ p, situs }) => (
                  <li key={p.kode}>
                    <a
                      href={situs}
                      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Situs {p.nama}
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </li>
                ))}
              {institusi.situs ? (
                <li>
                  <a
                    href={institusi.situs}
                    className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {institusi.namaSingkat || institusi.nama}
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </li>
              ) : null}
              <li>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Masuk sebagai dosen
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t">
          <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-muted-foreground md:px-6">
            Dokumen di halaman ini dicetak dari salinan beku yang dibuat saat
            pengesahan dan diberi sidik SHA-256 — isinya tidak berubah meski
            kurikulum disunting setelahnya.
          </p>
        </div>
      </footer>
    </div>
  );
}
