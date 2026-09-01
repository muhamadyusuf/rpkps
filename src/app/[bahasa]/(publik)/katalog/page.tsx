import type { Metadata } from "next";
import {
  daftarProdiPublik,
  daftarRpkpsPublik,
  daftarTahunAkademikPublik,
  muatInstitusi,
} from "@/lib/publik/muat";
import { urlSitus } from "@/lib/publik/tautan";
import { KatalogPerSemester } from "../komponen";
import { PapanSaringan } from "./saringan";
import { bacaSaringan } from "./saringan-alamat";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";

export async function generateMetadata(): Promise<Metadata> {
  const [institusi, k] = await Promise.all([muatInstitusi(), kamus()]);

  return {
    title: k.katalog.metaJudul,
    description: isi(k.katalog.metaDeskripsi, { institusi: institusi.nama }),
    alternates: { canonical: `${urlSitus()}/katalog` },
  };
}

export default async function HalamanKatalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const mentah = await searchParams;
  const saringan = bacaSaringan(mentah);

  const [prodi, tahunAkademik, butir, k] = await Promise.all([
    daftarProdiPublik(),
    daftarTahunAkademikPublik(),
    daftarRpkpsPublik(saringan),
    kamus(),
  ]);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {k.katalog.judul}
        </h1>
        <p className="mt-2 text-muted-foreground text-pretty">{k.katalog.keterangan}</p>
      </header>

      <PapanSaringan
        action="/katalog"
        daftarProdi={prodi}
        daftarTahunAkademik={tahunAkademik}
        nilai={{
          cari: saringan.cari,
          prodi: saringan.prodi,
          ta: saringan.tahunAkademik,
          semester: saringan.semester ? String(saringan.semester) : undefined,
        }}
      />

      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {isi(k.katalog.jumlahMk, { jumlah: butir.length })}
      </p>

      <KatalogPerSemester butir={butir} />
    </div>
  );
}
