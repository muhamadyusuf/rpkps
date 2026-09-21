import { Tautan } from "@/components/tautan";
import { ArrowUpRight, LogIn, ShieldCheck } from "lucide-react";
import { TandaAplikasi } from "@/components/lambang";
import { TombolTema } from "@/components/pengalih-tema";
import { TombolBahasa } from "@/components/pengalih-bahasa";
import { ButtonLink } from "@/components/ui/button";
import { daftarProdiPublik, muatInstitusi } from "@/lib/publik/muat";
import { NavigasiPublik } from "./navigasi-publik";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import gaya from "./publik.module.css";

/**
 * Kerangka halaman publik.
 *
 * Sengaja berbeda dari layout aplikasi: tanpa rel samping, satu bilah atas
 * yang ramping, dan ruang yang lebih longgar. Pembaca di sini datang dari
 * tautan luar dan hanya membaca satu dokumen — bukan berpindah antar modul.
 * Token visual terlingkup pada pembungkus ini agar aplikasi internal dan
 * dokumen cetak tetap memakai gaya masing-masing.
 */
export default async function LayoutPublik({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prodi, institusi, k] = await Promise.all([
    daftarProdiPublik(),
    muatInstitusi(),
    kamus(),
  ]);

  return (
    <div className={`${gaya.shell} flex min-h-dvh flex-col`}>
      <a href="#konten-publik" className={gaya.skip}>{k.publikHalaman.kerangka.lewati}</a>
      <header className={`${gaya.header} sticky top-0 z-40 print:hidden`}>
        <div className={`${gaya.headerInner} mx-auto flex w-full max-w-7xl items-center px-4 md:px-6`}>
          <Tautan href="/" className={`${gaya.brand} focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none`}>
            <TandaAplikasi />
          </Tautan>

          <NavigasiPublik className={`${gaya.navigation} hidden sm:flex`} />

          <div className="ml-auto flex items-center gap-1">
            <TombolBahasa />
            <TombolTema />
            <ButtonLink variant="default" size="sm" href="/dashboard" className="ml-2" aria-label={k.publik.masuk}>
              <LogIn />
              <span className="hidden sm:inline">{k.publik.masuk}</span>
            </ButtonLink>
          </div>
        </div>

        {/* Pada ponsel navigasi turun satu baris agar lambang dan tombol
            Masuk tidak berdesakan di bilah yang sama. */}
        <NavigasiPublik className={`${gaya.navigation} border-t px-3 sm:hidden`} />
      </header>

      <main id="konten-publik" tabIndex={-1} className={`${gaya.main} mx-auto w-full max-w-7xl flex-1 px-4 outline-none md:px-6`}>
        {children}
      </main>

      <footer className={`${gaya.footer} print:hidden`}>
        <div className={`${gaya.footerInner} mx-auto grid w-full max-w-7xl gap-8 px-4 md:px-6`}>
          <div>
            <TandaAplikasi />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {isi(k.publikHalaman.kerangka.footerIsi, { institusi: institusi.nama })}
            </p>
          </div>

          <div>
            <p className="label-teknis mb-3 text-muted-foreground/70">
              {k.publikHalaman.kerangka.footerProdi}
            </p>
            <ul className="space-y-1.5 text-sm">
              {prodi.map((p) => (
                <li key={p.kode}>
                  <Tautan
                    href={`/katalog/${p.kode.toLowerCase()}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p.nama}
                  </Tautan>
                </li>
              ))}
              {prodi.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {k.publikHalaman.kerangka.footerKosong}
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="label-teknis mb-3 text-muted-foreground/70">
              {k.publikHalaman.kerangka.footerTautan}
            </p>
            <ul className="space-y-1.5 text-sm">
              {prodi
                .map((p) => ({ p, situs: p.situs }))
                .filter((x): x is { p: (typeof prodi)[number]; situs: string } =>
                  Boolean(x.situs),
                )
                .map(({ p, situs }) => (
                  <li key={p.kode}>
                    <a
                      href={situs}
                      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {isi(k.publikHalaman.kerangka.footerSitus, { nama: p.nama })}
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
                <Tautan
                  href="/dashboard"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {k.publikHalaman.kerangka.footerMasuk}
                </Tautan>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t">
          <p className={`${gaya.footerNote} mx-auto w-full max-w-7xl px-4 text-xs text-muted-foreground md:px-6`}>
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cahaya" aria-hidden />
            {k.publikHalaman.kerangka.footerSidik}
          </p>
        </div>
      </footer>
    </div>
  );
}
