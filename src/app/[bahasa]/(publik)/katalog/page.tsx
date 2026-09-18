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
import gaya from "../katalog.module.css";

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
    <div className={gaya.halaman}>
      <header className={gaya.kepalaHalaman}>
        <div>
          <p className={gaya.penanda}>RPKPS / OBE</p>
          <h1 className={gaya.judul}>{k.katalog.judul}</h1>
        </div>
        <p className={gaya.deskripsi}>{k.katalog.keterangan}</p>
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

      <p className={gaya.jumlahHasil}>
        {isi(k.katalog.jumlahMk, { jumlah: butir.length })}
      </p>

      <KatalogPerSemester butir={butir} />
    </div>
  );
}
