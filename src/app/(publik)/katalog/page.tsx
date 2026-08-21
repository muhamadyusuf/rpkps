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

export async function generateMetadata(): Promise<Metadata> {
  const institusi = await muatInstitusi();

  return {
    title: "Katalog mata kuliah",
    description: `Telusuri seluruh RPKPS terbit ${institusi.nama} berdasarkan program studi, tahun akademik, dan semester.`,
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

  const [prodi, tahunAkademik, butir] = await Promise.all([
    daftarProdiPublik(),
    daftarTahunAkademikPublik(),
    daftarRpkpsPublik(saringan),
  ]);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Katalog mata kuliah
        </h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Seluruh RPKPS yang sudah disahkan Ketua Program Studi, lintas program
          studi dan tahun akademik. Kartu menunjukkan penerbitan terbaru tiap
          mata kuliah; versi tahun sebelumnya dapat dibuka dari halaman
          dokumen.
        </p>
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
        {butir.length} mata kuliah
      </p>

      <KatalogPerSemester butir={butir} />
    </div>
  );
}
