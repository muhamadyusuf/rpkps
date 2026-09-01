import type { Metadata } from "next";
import type { Kamus } from "@/kamus";
import { Tautan } from "@/components/tautan";
import {
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  Search,
  ShieldCheck,
  Target,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { labelTahunAkademik } from "@/domain/rpkps/publik";
import {
  angkaKatalog,
  daftarProdiPublik,
  muatInstitusi,
  terakhirDisahkan,
} from "@/lib/publik/muat";
import { jalurRpkpsPublik, situsProdi, urlSitus } from "@/lib/publik/tautan";
import { KartuAngka } from "./komponen";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi } from "@/lib/bahasa/teks";

/**
 * Dirender saat diminta, bukan saat build.
 *
 * ISR akan lebih hemat, tetapi memaksa `next build` menyentuh database — dan
 * pipeline penyebaran belum tentu punya jalur ke sana. Dedup per permintaan
 * ditangani `cache()` di lib/publik/muat.ts, jadi satu kunjungan tetap satu
 * kueri meski beberapa komponen memintanya.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const institusi = await muatInstitusi();

  const k = await kamus();

  return {
    title: isi(k.publikHalaman.meta.judul, {
      institusi: institusi.namaSingkat || institusi.nama,
    }),
    description: isi(k.publikHalaman.meta.deskripsi, { institusi: institusi.nama }),
    alternates: { canonical: urlSitus() },
  };
}

export default async function BerandaPublik() {
  const [angka, prodi, terbaru, institusi, k, b] = await Promise.all([
    angkaKatalog(),
    daftarProdiPublik(),
    terakhirDisahkan(6),
    muatInstitusi(),
    kamus(),
    bahasaAktif(),
  ]);

  return (
    <div className="space-y-16">
      <Hero jumlahDokumen={angka.dokumen} institusi={institusi.nama} k={k} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          label={k.publikHalaman.angka.dokumen}
          nilai={angka.dokumen}
          keterangan={k.publikHalaman.angka.dokumenKeterangan}
        />
        <KartuAngka
          label={k.publikHalaman.angka.mataKuliah}
          nilai={angka.mataKuliah}
          keterangan={k.publikHalaman.angka.mataKuliahKeterangan}
        />
        <KartuAngka
          label={k.publikHalaman.angka.prodi}
          nilai={angka.prodi}
          keterangan={k.publikHalaman.angka.prodiKeterangan}
        />
        <KartuAngka
          label={k.publikHalaman.angka.tahunAkademik}
          nilai={angka.tahunAkademik}
          keterangan={k.publikHalaman.angka.tahunAkademikKeterangan}
        />
      </section>

      <section>
        <KepalaBagian
          judul={k.publikHalaman.prodi.judul}
          keterangan={k.publikHalaman.prodi.keterangan}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {prodi.map((p) => {
            const situs = situsProdi(p.kode);
            return (
              <div
                key={p.kode}
                className="panel flex flex-col rounded-xl border bg-card p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-cahaya/30 bg-cahaya/10">
                    <GraduationCap className="size-4.5 text-cahaya" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs tracking-wide text-muted-foreground">
                      {p.kode} · {p.jenjang}
                    </p>
                    <h3 className="font-heading text-base font-semibold text-balance">
                      {p.nama}
                    </h3>
                  </div>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {p.jumlah}
                  </span>{" "}
                  {k.publikHalaman.prodi.jumlahMk}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ButtonLink
                    size="sm"
                    variant="outline"
                    href={`/katalog/${p.kode.toLowerCase()}`}
                  >
                    {k.publikHalaman.prodi.lihat}
                    <ArrowRight data-icon="inline-end" />
                  </ButtonLink>
                  {situs ? (
                    <a
                      href={situs}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {k.publikHalaman.prodi.situs}
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}

          {prodi.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              {k.publikHalaman.prodi.kosong}
            </p>
          ) : null}
        </div>
      </section>

      {terbaru.length > 0 ? (
        <section>
          <KepalaBagian
            judul={k.publikHalaman.terbaru.judul}
            keterangan={k.publikHalaman.terbaru.keterangan}
          />

          <ul className="mt-5 divide-y rounded-xl border bg-card panel">
            {terbaru.map((t) => (
              <li key={`${t.prodiKode}-${t.kode}-${t.tahunAkademik}`}>
                <Tautan
                  href={jalurRpkpsPublik(t.prodiKode, t.kode)}
                  className="group/baris flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <span className="font-mono text-sm font-semibold text-cahaya">
                    {t.kode}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t.nama}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {sidikRingkas(t.sidik)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {tanggal(t.disahkanPada, b, "panjang")}
                  </span>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    v{t.versi} · {labelTahunAkademik(t.tahunAkademik)}
                  </Badge>
                </Tautan>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <KepalaBagian
          judul={k.publikHalaman.caraBaca.judul}
          keterangan={k.publikHalaman.caraBaca.keterangan}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Penjelas
            ikon={Target}
            judul={k.publikHalaman.caraBaca.capaianJudul}
            isi={k.publikHalaman.caraBaca.capaianIsi}
          />
          <Penjelas
            ikon={Timer}
            judul={k.publikHalaman.caraBaca.bebanJudul}
            isi={k.publikHalaman.caraBaca.bebanIsi}
          />
          <Penjelas
            ikon={ShieldCheck}
            judul={k.publikHalaman.caraBaca.kunciJudul}
            isi={k.publikHalaman.caraBaca.kunciIsi}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Kepala halaman. `.siku` menandai bidang ini sebagai bidang utama — dipakai
 * hemat, hanya sekali per halaman, sesuai aturan bahasa rupa.
 */
function Hero({
  jumlahDokumen,
  institusi,
  k,
}: {
  jumlahDokumen: number;
  institusi: string;
  k: Kamus;
}) {
  return (
    <section className="panel siku relative overflow-hidden rounded-2xl border bg-card px-6 py-12 md:px-12 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 kisi opacity-60"
      />

      <div className="max-w-2xl">
        <Badge variant="outline" className="font-mono text-[10px]">
          {institusi}
        </Badge>

        <h1 className="mt-4 font-heading text-3xl leading-[1.1] font-semibold text-balance md:text-5xl">
          {k.publikHalaman.hero.judul}
        </h1>

        <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty md:text-lg">
          {isi(k.publikHalaman.hero.isi, {
            dokumen: jumlahDokumen > 0 ? `${jumlahDokumen} ` : "",
          })}
        </p>

        <form action="/katalog" className="mt-8 flex max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="cari"
              placeholder={k.publikHalaman.hero.cariPlaceholder}
              aria-label={k.publikHalaman.hero.cariAria}
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" size="lg">
            {k.publikHalaman.hero.cari}
          </Button>
        </form>
      </div>
    </section>
  );
}

function KepalaBagian({
  judul,
  keterangan,
}: {
  judul: string;
  keterangan: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
        {judul}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
        {keterangan}
      </p>
    </div>
  );
}

function Penjelas({
  ikon: Ikon,
  judul,
  isi,
}: {
  ikon: React.ComponentType<{ className?: string }>;
  judul: string;
  isi: string;
}) {
  return (
    <div className="panel rounded-xl border bg-card p-5">
      <Ikon className="size-5 text-cahaya" />
      <h3 className="mt-3 font-heading text-base font-semibold">{judul}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
        {isi}
      </p>
    </div>
  );
}
