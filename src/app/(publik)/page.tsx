import type { Metadata } from "next";
import Link from "next/link";
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
import { KartuAngka, tanggalPanjang } from "./komponen";

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

  return {
    title: `Katalog RPKPS ${institusi.namaSingkat || institusi.nama}`,
    description: `Rencana Program dan Kegiatan Pembelajaran Semester ${institusi.nama} — capaian pembelajaran, rencana mingguan, dan penilaian tiap mata kuliah, terbuka untuk umum.`,
    alternates: { canonical: urlSitus() },
  };
}

export default async function BerandaPublik() {
  const [angka, prodi, terbaru, institusi] = await Promise.all([
    angkaKatalog(),
    daftarProdiPublik(),
    terakhirDisahkan(6),
    muatInstitusi(),
  ]);

  return (
    <div className="space-y-16">
      <Hero jumlahDokumen={angka.dokumen} institusi={institusi.nama} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          label="Dokumen terbit"
          nilai={angka.dokumen}
          keterangan="RPKPS yang sudah disahkan"
        />
        <KartuAngka
          label="Mata kuliah"
          nilai={angka.mataKuliah}
          keterangan="Punya minimal satu RPKPS terbit"
        />
        <KartuAngka
          label="Program studi"
          nilai={angka.prodi}
          keterangan="Ikut dalam katalog terbuka"
        />
        <KartuAngka
          label="Tahun akademik"
          nilai={angka.tahunAkademik}
          keterangan="Tercakup arsipnya"
        />
      </section>

      <section>
        <KepalaBagian
          judul="Program studi"
          keterangan="Telusuri seluruh mata kuliah beserta rencana pembelajarannya."
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
                  mata kuliah dengan RPKPS terbit
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ButtonLink
                    size="sm"
                    variant="outline"
                    href={`/katalog/${p.kode.toLowerCase()}`}
                  >
                    Lihat katalog
                    <ArrowRight data-icon="inline-end" />
                  </ButtonLink>
                  {situs ? (
                    <a
                      href={situs}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Situs prodi
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}

          {prodi.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              Belum ada RPKPS yang diterbitkan. Katalog akan terisi sendiri
              begitu Ketua Program Studi mengesahkan dokumen pertama.
            </p>
          ) : null}
        </div>
      </section>

      {terbaru.length > 0 ? (
        <section>
          <KepalaBagian
            judul="Terakhir disahkan"
            keterangan="Tiap pengesahan menghasilkan salinan beku dengan sidik SHA-256 yang dapat diperiksa ulang."
          />

          <ul className="mt-5 divide-y rounded-xl border bg-card panel">
            {terbaru.map((t) => (
              <li key={`${t.prodiKode}-${t.kode}-${t.tahunAkademik}`}>
                <Link
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
                    {tanggalPanjang(t.disahkanPada)}
                  </span>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    v{t.versi} · {labelTahunAkademik(t.tahunAkademik)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <KepalaBagian
          judul="Cara membaca dokumen ini"
          keterangan="Tiga hal yang membedakan RPKPS berbasis OBE dari silabus biasa."
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Penjelas
            ikon={Target}
            judul="Berbasis capaian"
            isi="Setiap topik mingguan terikat ke Sub-CPMK, yang naik ke CPMK, lalu ke Capaian Pembelajaran Lulusan. Yang dinilai adalah kemampuan yang dijanjikan, bukan sekadar materi yang sempat dibahas."
          />
          <Penjelas
            ikon={Timer}
            judul="Beban belajar terukur"
            isi="Total beban dibagi jumlah sks selalu 45 jam per semester, sesuai Permendikbudristek 53/2023. Alokasi tatap muka, tugas terstruktur, dan belajar mandiri dihitung menit demi menit, bukan diperkirakan."
          />
          <Penjelas
            ikon={ShieldCheck}
            judul="Terkunci saat disahkan"
            isi="Begitu Ketua Program Studi menyetujui, seluruh isi dokumen dibekukan dan diberi sidik SHA-256. Halaman ini menampilkan salinan beku itu — bukan data yang masih bisa berubah."
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
}: {
  jumlahDokumen: number;
  institusi: string;
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
          Rencana pembelajaran setiap mata kuliah, terbuka untuk dibaca
        </h1>

        <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty md:text-lg">
          Capaian pembelajaran, rencana mingguan, rancangan tugas, dan cara
          penilaian — {jumlahDokumen > 0 ? `${jumlahDokumen} dokumen ` : ""}
          RPKPS yang sudah disahkan, tanpa perlu masuk.
        </p>

        <form action="/katalog" className="mt-8 flex max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="cari"
              placeholder="Cari kode atau nama mata kuliah…"
              aria-label="Cari mata kuliah"
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" size="lg">
            Cari
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
