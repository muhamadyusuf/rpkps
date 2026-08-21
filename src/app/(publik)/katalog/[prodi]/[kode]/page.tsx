import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { labelTahunAkademik, ringkasSks } from "@/domain/rpkps/publik";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { muatRpkpsPublik } from "@/lib/publik/muat";
import { jalurRpkpsPublik, urlSitus } from "@/lib/publik/tautan";
import { tanggalPanjang } from "../../../komponen";
import {
  Bagian,
  BagianCapaian,
  BagianDeskripsi,
  BagianMingguan,
  BagianPengampu,
  BagianPenilaian,
  BagianPustaka,
  BagianTugas,
  Panel,
} from "./bagian";
import { DaftarIsi, type ButirDaftarIsi } from "./daftar-isi";
import { TombolCetak } from "./tombol-cetak";

export const dynamic = "force-dynamic";

type Params = { prodi: string; kode: string };
type Query = Record<string, string | string[] | undefined>;

function tahunAkademikDiminta(query: Query): string | undefined {
  const nilai = Array.isArray(query.ta) ? query.ta[0] : query.ta;
  return nilai?.trim() || undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}): Promise<Metadata> {
  const [{ prodi, kode }, query] = await Promise.all([params, searchParams]);
  const rpkps = await muatRpkpsPublik(prodi, kode, tahunAkademikDiminta(query));
  if (!rpkps) return { title: "Dokumen tidak ditemukan" };

  const mk = rpkps.dokumen.mataKuliah;
  const judul = `${mk.kode} ${mk.nama}`;
  const deskripsi =
    rpkps.dokumen.deskripsi?.replace(/\s+/g, " ").slice(0, 180) ??
    `RPKPS ${mk.nama} (${ringkasSks(mk)}), program studi ${rpkps.prodi.nama}, ${labelTahunAkademik(rpkps.tahunAkademik)}.`;

  return {
    title: judul,
    description: deskripsi,
    alternates: {
      canonical: `${urlSitus()}${jalurRpkpsPublik(rpkps.prodi.kode, mk.kode)}`,
    },
    openGraph: {
      title: `${judul} · RPKPS ITTS`,
      description: deskripsi,
      type: "article",
    },
  };
}

export default async function HalamanDokumenPublik({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const [{ prodi, kode }, query] = await Promise.all([params, searchParams]);
  const ta = tahunAkademikDiminta(query);

  const rpkps = await muatRpkpsPublik(prodi, kode, ta);
  if (!rpkps) notFound();

  const dok = rpkps.dokumen;
  const mk = dok.mataKuliah;

  const daftarIsi: ButirDaftarIsi[] = [
    { id: "deskripsi", label: "Deskripsi" },
    { id: "capaian", label: "Capaian pembelajaran" },
    { id: "mingguan", label: "Rencana mingguan" },
    ...(dok.tugas.length > 0
      ? [{ id: "tugas", label: "Rencana tugas" }]
      : []),
    { id: "penilaian", label: "Penilaian" },
    { id: "pustaka", label: "Referensi" },
    { id: "pengampu", label: "Tim pengampu" },
    ...(rpkps.riwayat.length > 0
      ? [{ id: "riwayat", label: "Riwayat dokumen" }]
      : []),
  ];

  return (
    <div className="space-y-8">
      <nav
        aria-label="Remah roti"
        className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground print:hidden"
      >
        <Link href="/katalog" className="transition-colors hover:text-foreground">
          Katalog
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href={`/katalog/${rpkps.prodi.kode.toLowerCase()}`}
          className="transition-colors hover:text-foreground"
        >
          {rpkps.prodi.nama}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-mono text-foreground">{mk.kode}</span>
      </nav>

      <header className="panel siku rounded-2xl border bg-card px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {mk.kode}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            Semester {mk.semester}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {mk.status === "WAJIB_UMUM" ? "Wajib umum" : mk.status === "PILIHAN" ? "Pilihan" : "Wajib"}
          </Badge>
        </div>

        <h1 className="mt-3 font-heading text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
          {mk.nama}
        </h1>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Meta label="Program studi" nilai={`${rpkps.prodi.nama} (${rpkps.prodi.jenjang})`} />
          <Meta label="Beban" nilai={ringkasSks(mk)} mono />
          <Meta label="Tahun akademik" nilai={labelTahunAkademik(rpkps.tahunAkademik)} mono />
          <Meta label="Kurikulum" nilai={`${rpkps.kurikulum.nama} (${rpkps.kurikulum.tahun})`} />
        </dl>

        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <ButtonLink href={`/api/publik/rpkps/${rpkps.id}/docx`} prefetch={false}>
            <Download />
            Unduh dokumen resmi
          </ButtonLink>
          <TombolCetak />
        </div>

        {rpkps.versiLain.length > 1 ? (
          <div className="mt-6 print:hidden">
            <p className="label-teknis mb-2 text-muted-foreground/70">
              Tahun akademik lain
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rpkps.versiLain.map((kodeTa) => {
                const aktif = kodeTa === rpkps.tahunAkademik;
                return (
                  <Link
                    key={kodeTa}
                    href={`${jalurRpkpsPublik(rpkps.prodi.kode, mk.kode)}?ta=${encodeURIComponent(kodeTa)}`}
                    aria-current={aktif ? "page" : undefined}
                    className={
                      aktif
                        ? "rounded-md border border-cahaya/45 bg-cahaya/12 px-2.5 py-1 font-mono text-xs tabular-nums"
                        : "rounded-md border border-border px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:border-cahaya/35 hover:text-foreground"
                    }
                  >
                    {labelTahunAkademik(kodeTa)}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <PitaSidik
        sidik={rpkps.sidik}
        versi={rpkps.versi}
        disahkanPada={rpkps.disahkanPada}
      />

      <div className="gap-10 xl:grid xl:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <DaftarIsi butir={daftarIsi} />
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          <Bagian
            id="deskripsi"
            judul="Deskripsi mata kuliah"
            keterangan="Cakupan dan posisi mata kuliah ini dalam kurikulum."
          >
            <BagianDeskripsi dok={dok} />
          </Bagian>

          <Bagian
            id="capaian"
            judul="Capaian pembelajaran"
            keterangan="Diambil dari buku kurikulum program studi dan bersifat baku — CPMK dan Sub-CPMK tidak dapat diubah pada penyusunan RPKPS."
          >
            <BagianCapaian dok={dok} />
          </Bagian>

          <Bagian
            id="mingguan"
            judul="Rencana pembelajaran mingguan"
            keterangan="Alokasi waktu dihitung menit demi menit dan diperiksa terhadap invarian 45 jam per sks per semester."
          >
            <BagianMingguan dok={dok} />
          </Bagian>

          {dok.tugas.length > 0 ? (
            <Bagian
              id="tugas"
              judul="Rencana tugas"
              keterangan="Rancangan tugas beserta linimasa dan kriteria penilaiannya."
            >
              <BagianTugas dok={dok} />
            </Bagian>
          ) : null}

          <Bagian
            id="penilaian"
            judul="Penilaian"
            keterangan="Bobot tiap komponen dan ambang yang dipakai untuk menyatakan kelulusan."
          >
            <BagianPenilaian dok={dok} />
          </Bagian>

          <Bagian id="pustaka" judul="Referensi dan sumber">
            <BagianPustaka dok={dok} />
          </Bagian>

          <Bagian id="pengampu" judul="Tim pengampu">
            <BagianPengampu dok={dok} />
          </Bagian>

          {rpkps.riwayat.length > 0 ? (
            <Bagian
              id="riwayat"
              judul="Riwayat dokumen"
              keterangan="Jejak penyusunan hingga pengesahan."
            >
              <Panel>
                <ol className="space-y-3">
                  {rpkps.riwayat.map((r, i) => (
                    <li key={i} className="flex gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {tanggalPanjang(r.dibuatPada)}
                      </span>
                      <span className="min-w-0">
                        <Badge variant="outline" className="mr-2 font-mono text-[10px]">
                          v{r.versi}
                        </Badge>
                        {r.deskripsi}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </Bagian>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Pita pengesahan.
 *
 * Sidik dicetak lengkap dalam bentuk ringkas dan disediakan utuh lewat
 * `title`, supaya siapa pun yang memegang berkas DOCX bisa membandingkannya
 * dengan yang tertera di sini — itulah gunanya sidik: membuktikan berkas dan
 * halaman ini berasal dari isi yang sama.
 */
function PitaSidik({
  sidik,
  versi,
  disahkanPada,
}: {
  sidik: string;
  versi: number;
  disahkanPada: Date;
}) {
  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <ShieldCheck className="size-5 shrink-0 text-success" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Disahkan {tanggalPanjang(disahkanPada)}</span>
        <span className="text-muted-foreground">
          {" "}
          — versi {versi}, isinya dibekukan pada tanggal itu.
        </span>
      </p>
      <code
        title={sidik}
        className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
      >
        {sidikRingkas(sidik)}
      </code>
    </div>
  );
}

function Meta({
  label,
  nilai,
  mono = false,
}: {
  label: string;
  nilai: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="label-teknis text-muted-foreground/70">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono tabular-nums text-foreground" : "mt-0.5 text-foreground"}>
        {nilai}
      </dd>
    </div>
  );
}
