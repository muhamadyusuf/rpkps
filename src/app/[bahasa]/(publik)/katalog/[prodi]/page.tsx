import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tautan } from "@/components/tautan";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  daftarProdiPublik,
  daftarRpkpsPublik,
  daftarTahunAkademikPublik,
  muatInstitusi,
  profilLulusanProdi,
} from "@/lib/publik/muat";
import { urlSitus } from "@/lib/publik/tautan";
import { KartuAngka, KatalogPerSemester } from "../../komponen";
import { PapanSaringan } from "../saringan";
import { bacaSaringan } from "../saringan-alamat";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk, pilihDaftar, pilihTeks } from "@/lib/bahasa/teks";
import gaya from "../../katalog.module.css";

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
  const [prodi, institusi, k] = await Promise.all([
    cariProdi(kode),
    muatInstitusi(),
    kamus(),
  ]);
  if (!prodi) return { title: k.katalog.prodi.metaTidakDitemukan };

  const judul = isi(k.katalog.prodi.metaJudul, { nama: prodi.nama });
  const deskripsi = isi(k.katalog.prodi.metaDeskripsi, {
    jumlah: prodi.jumlah,
    nama: prodi.nama,
    jenjang: prodi.jenjang,
    institusi: institusi.nama,
  });

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

  const [tahunAkademik, butir, profilLulusan, k, b] = await Promise.all([
    daftarTahunAkademikPublik(),
    daftarRpkpsPublik(saringan),
    profilLulusanProdi(prodi.kode),
    kamus(),
    bahasaAktif(),
  ]);

  const situs = prodi.situs;
  /*
   * Cadangan satu arah: pembaca Inggris melihat teks Indonesia bila
   * terjemahannya belum ada, tidak pernah sebaliknya (docs/11 §5.4).
   */
  const namaProdi = namaMk(prodi, b);
  const visi = pilihTeks(prodi.visi, prodi.visiEn, b);
  const misi = pilihDaftar(prodi.misi, prodi.misiEn, b);
  const totalSks = butir.reduce((s, b) => s + b.sksTeori + b.sksPraktik, 0);
  const semesterTercakup = new Set(butir.map((b) => b.semester)).size;

  return (
    <div className={gaya.halaman}>
      <nav
        aria-label={k.katalog.prodi.remahRoti}
        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Tautan href="/katalog" className="transition-colors hover:text-foreground">
          {k.katalog.prodi.remahKatalog}
        </Tautan>
        <ChevronRight aria-hidden className="size-3.5 shrink-0" />
        <span className="text-foreground">{prodi.nama}</span>
      </nav>

      <header className={gaya.kepalaProdi}>
        <div className={gaya.isiKepalaProdi}>
          <div className={gaya.penanda}>
            <span>{prodi.kode}</span>
            <span aria-hidden>/</span>
            <span>{prodi.jenjang}</span>
          </div>
          <h1 className={gaya.judulProdi}>{namaProdi}</h1>
          <p className={gaya.deskripsiProdi}>
            {k.katalog.prodi.keterangan}
          </p>

          {situs ? (
            <a href={situs} className={gaya.tautanSitus}>
              {k.katalog.prodi.kunjungiSitus}
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          ) : null}
        </div>
        <div className={gaya.monogramProdi}>
          {prodi.logoVersi ? (
            // eslint-disable-next-line @next/next/no-img-element -- bita dilayani rute sendiri, bukan berkas statis yang dapat dioptimasi
            <img
              src={`/api/prodi/${prodi.id}/logo?v=${prodi.logoVersi}`}
              alt={isi(k.katalog.prodi.lambangAlt, { nama: namaProdi })}
              className={gaya.lambangProdi}
            />
          ) : (
            <span aria-hidden>{prodi.kode}</span>
          )}
          <span aria-hidden className={gaya.monogramJenjang}>
            {prodi.jenjang}
          </span>
        </div>
      </header>

      {visi.teks || misi.teks.length > 0 ? (
        <section className={gaya.visiMisi}>
          {visi.teks ? (
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {k.katalog.prodi.visiJudul}
              </h2>
              <p className={gaya.visiTeks}>{visi.teks}</p>
            </div>
          ) : null}

          {misi.teks.length > 0 ? (
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {k.katalog.prodi.misiJudul}
              </h2>
              <ol className={gaya.daftarMisi}>
                {misi.teks.map((butir, i) => (
                  <li key={i} className={gaya.butirMisi}>
                    <span aria-hidden className={gaya.nomorMisi}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{butir}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {profilLulusan.length > 0 ? (
        <section className={gaya.profil}>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {k.katalog.prodi.profilJudul}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
            {k.katalog.prodi.profilKeterangan}
          </p>

          <ol className={gaya.daftarProfil}>
            {profilLulusan.map((p, i) => (
              <li key={p.kode} className={gaya.kartuProfil}>
                <div className="flex items-baseline gap-2.5">
                  <span aria-hidden className={gaya.nomorProfil}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge variant="outline" className="rounded-sm font-mono text-[10px]">
                    {p.kode}
                  </Badge>
                </div>

                <p className="mt-2.5 leading-relaxed text-pretty">{p.deskripsi}</p>

                {p.cpl.length > 0 ? (
                  <div className="mt-4 border-t pt-3">
                    <p className="label-teknis mb-2 text-muted-foreground">
                      {k.katalog.prodi.ditopangCapaian}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.cpl.map((c) => (
                        <span
                          key={c.kode}
                          title={c.deskripsi}
                          className="border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
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

      <section className={gaya.statistikProdi}>
        <KartuAngka label={k.katalog.prodi.angkaMk} nilai={butir.length} />
        <KartuAngka label={k.katalog.prodi.angkaSks} nilai={totalSks} />
        <KartuAngka label={k.katalog.prodi.angkaSemester} nilai={semesterTercakup} />
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
