import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  daftarProdiPublik,
  daftarRpkpsPublik,
  daftarTahunAkademikPublik,
  muatInstitusi,
  profilLulusanProdi,
} from "@/lib/publik/muat";
import { situsProdi, urlSitus } from "@/lib/publik/tautan";
import { KartuAngka, KatalogPerSemester } from "../../komponen";
import { PapanSaringan } from "../saringan";
import { bacaSaringan } from "../saringan-alamat";

export const dynamic = "force-dynamic";

async function cariProdi(kode: string) {
  const semua = await daftarProdiPublik();
  return semua.find((p) => p.kode.toLowerCase() === kode.toLowerCase()) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ prodi: string }>;
}): Promise<Metadata> {
  const { prodi: kode } = await params;
  const [prodi, institusi] = await Promise.all([cariProdi(kode), muatInstitusi()]);
  if (!prodi) return { title: "Program studi tidak ditemukan" };

  const judul = `RPKPS ${prodi.nama}`;
  const deskripsi = `Rencana Program dan Kegiatan Pembelajaran Semester untuk ${prodi.jumlah} mata kuliah program studi ${prodi.nama} (${prodi.jenjang}), ${institusi.nama}.`;

  return {
    title: judul,
    description: deskripsi,
    alternates: { canonical: `${urlSitus()}/katalog/${prodi.kode.toLowerCase()}` },
    openGraph: { title: judul, description: deskripsi, type: "website" },
  };
}

export default async function HalamanProdi({
  params,
  searchParams,
}: {
  params: Promise<{ prodi: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ prodi: kodeProdi }, mentah] = await Promise.all([params, searchParams]);

  const prodi = await cariProdi(kodeProdi);
  if (!prodi) notFound();

  // Prodi ditentukan alamat, jadi apa pun yang dikirim lewat `?prodi=` diabaikan.
  const saringan = { ...bacaSaringan(mentah), prodi: prodi.kode };

  const [tahunAkademik, butir, profilLulusan] = await Promise.all([
    daftarTahunAkademikPublik(),
    daftarRpkpsPublik(saringan),
    profilLulusanProdi(prodi.kode),
  ]);

  const situs = situsProdi(prodi.kode);
  const totalSks = butir.reduce((s, b) => s + b.sksTeori + b.sksPraktik, 0);
  const semesterTercakup = new Set(butir.map((b) => b.semester)).size;

  return (
    <div className="space-y-8">
      <nav aria-label="Remah roti" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/katalog" className="transition-colors hover:text-foreground">
          Katalog
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{prodi.nama}</span>
      </nav>

      <header className="panel siku rounded-2xl border bg-card px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {prodi.kode}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {prodi.jenjang}
          </Badge>
        </div>

        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {prodi.nama}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">
          Seluruh rencana pembelajaran yang sudah disahkan program studi ini.
          Tiap dokumen memuat capaian pembelajaran, rencana mingguan, rancangan
          tugas, dan cara penilaian.
        </p>

        {situs ? (
          <a
            href={situs}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
          >
            Kunjungi situs program studi
            <ArrowUpRight className="size-4" />
          </a>
        ) : null}
      </header>

      {profilLulusan.length > 0 ? (
        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Profil lulusan
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
            Peran yang dijanjikan program studi kepada lulusannya. Setiap profil
            ditopang capaian pembelajaran yang dibebankan ke mata kuliah di
            katalog bawah.
          </p>

          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {profilLulusan.map((p, i) => (
              <li key={p.kode} className="panel rounded-xl border bg-card p-5">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-cahaya/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {p.kode}
                  </Badge>
                </div>

                <p className="mt-2.5 leading-relaxed text-pretty">{p.deskripsi}</p>

                {p.cpl.length > 0 ? (
                  <div className="mt-4 border-t pt-3">
                    <p className="label-teknis mb-2 text-muted-foreground/70">
                      Ditopang capaian
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.cpl.map((c) => (
                        <span
                          key={c.kode}
                          title={c.deskripsi}
                          className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {c.kode}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <KartuAngka label="Mata kuliah" nilai={butir.length} />
        <KartuAngka label="Total sks" nilai={totalSks} />
        <KartuAngka label="Semester tercakup" nilai={semesterTercakup} />
      </section>

      <PapanSaringan
        action={`/katalog/${prodi.kode.toLowerCase()}`}
        daftarProdi={[]}
        daftarTahunAkademik={tahunAkademik}
        nilai={{
          cari: saringan.cari,
          ta: saringan.tahunAkademik,
          semester: saringan.semester ? String(saringan.semester) : undefined,
        }}
      />

      <KatalogPerSemester butir={butir} />
    </div>
  );
}
