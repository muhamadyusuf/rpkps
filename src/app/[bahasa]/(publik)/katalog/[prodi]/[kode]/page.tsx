import type { Metadata } from "next";
import { Tautan } from "@/components/tautan";
import { notFound } from "next/navigation";
import { ChevronRight, Languages, Download, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { labelTahunAkademik, ringkasSks } from "@/domain/rpkps/publik";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { muatRpkpsPublik } from "@/lib/publik/muat";
import { jalurRpkpsPublik, urlSitus } from "@/lib/publik/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi, pilihTeks } from "@/lib/bahasa/teks";
import type { Bahasa, Kamus } from "@/kamus";
import {
  Bagian,
  BagianCapaian,
  BagianDeskripsi,
  BagianMingguan,
  BagianPengampu,
  BagianPengesah,
  BagianPenilaian,
  BagianPustaka,
  BagianTugas,
  Panel,
} from "./bagian";
import { DaftarIsi, type ButirDaftarIsi } from "./daftar-isi";
import { TombolCetak } from "./tombol-cetak";
import { teksRiwayat } from "@/lib/bahasa/riwayat";
import { segalaBahasa } from "@/lib/bahasa/jalur";
import { BAHASA } from "@/kamus";

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
  const [rpkps, k] = await Promise.all([
    muatRpkpsPublik(prodi, kode, tahunAkademikDiminta(query)),
    kamus(),
  ]);
  if (!rpkps) return { title: k.dokumenPublik.metaTidakDitemukan };

  const b = await bahasaAktif();
  // Judul dan deskripsi mengikuti versi yang benar-benar ditampilkan halaman.
  const dokumen = b === "id" ? rpkps.dokumen : (rpkps.dokumenEn ?? rpkps.dokumen);
  const mk = dokumen.mataKuliah;
  const judul = `${mk.kode} ${mk.nama}`;
  const deskripsi =
    dokumen.deskripsi?.replace(/\s+/g, " ").slice(0, 180) ??
    isi(k.dokumenPublik.metaDeskripsiCadangan, {
      nama: mk.nama,
      sks: ringkasSks(mk),
      prodi: rpkps.prodi.nama,
      ta: labelTahunAkademik(rpkps.tahunAkademik),
    });

  return {
    title: judul,
    description: deskripsi,
    alternates: {
      canonical: `${urlSitus()}/${b}${jalurRpkpsPublik(rpkps.prodi.kode, mk.kode)}`,
      // hreflang per halaman: mesin pencari perlu tahu kedua alamat ini adalah
      // dokumen yang sama dalam dua bahasa, bukan dua dokumen yang mirip.
      // Ditulis meski versi Inggrisnya belum terbit — halamannya tetap ada dan
      // tetap menampilkan isi yang sah (docs/11 §2.6).
      languages: Object.fromEntries(
        segalaBahasa(jalurRpkpsPublik(rpkps.prodi.kode, mk.kode)).map((jalur, i) => [
          BAHASA[i],
          `${urlSitus()}${jalur}`,
        ]),
      ),
    },
    openGraph: {
      title: isi(k.dokumenPublik.metaOg, { judul }),
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

  const [rpkps, k, b] = await Promise.all([
    muatRpkpsPublik(prodi, kode, ta),
    kamus(),
    bahasaAktif(),
  ]);
  if (!rpkps) notFound();

  /**
   * Pembaca Inggris mendapat salinan beku berbahasa Inggris bila dokumen ini
   * pernah diterbitkan begitu. Bila tidak, ia mendapat salinan Indonesia —
   * yang memang dokumen yang sah — beserta keterangannya di bawah judul.
   */
  const dok = b === "id" ? rpkps.dokumen : (rpkps.dokumenEn ?? rpkps.dokumen);
  // Nama prodi datang dari data langsung, bukan salinan beku — ia identitas
  // unit, bukan isi dokumen yang ditandatangani.
  const namaProdi = pilihTeks(rpkps.prodi.nama, rpkps.prodi.namaEn, b).teks;
  const tanpaVersiEn = b !== "id" && rpkps.dokumenEn === null;
  const mk = dok.mataKuliah;
  const ti = k.dokumenPublik.daftarIsi;

  const daftarIsi: ButirDaftarIsi[] = [
    { id: "deskripsi", label: ti.deskripsi },
    { id: "capaian", label: ti.capaian },
    { id: "mingguan", label: ti.mingguan },
    ...(dok.tugas.length > 0 ? [{ id: "tugas", label: ti.tugas }] : []),
    { id: "penilaian", label: ti.penilaian },
    { id: "pustaka", label: ti.pustaka },
    { id: "pengampu", label: ti.pengampu },
    { id: "pengesahan", label: ti.pengesahan },
    ...(rpkps.riwayat.length > 0 ? [{ id: "riwayat", label: ti.riwayat }] : []),
  ];

  return (
    <div className="space-y-8">
      <nav
        aria-label={k.dokumenPublik.remahRoti}
        className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground print:hidden"
      >
        <Tautan href="/katalog" className="transition-colors hover:text-foreground">
          {k.dokumenPublik.remahKatalog}
        </Tautan>
        <ChevronRight className="size-3.5" />
        <Tautan
          href={`/katalog/${rpkps.prodi.kode.toLowerCase()}`}
          className="transition-colors hover:text-foreground"
        >
          {namaProdi}
        </Tautan>
        <ChevronRight className="size-3.5" />
        <span className="font-mono text-foreground">{mk.kode}</span>
      </nav>

      <header className="panel siku rounded-2xl border bg-card px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {mk.kode}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {isi(k.dokumenPublik.semester, { nomor: mk.semester })}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {mk.status === "WAJIB_UMUM"
              ? k.dokumenPublik.statusWajibUmum
              : mk.status === "PILIHAN"
                ? k.dokumenPublik.statusPilihan
                : k.dokumenPublik.statusWajib}
          </Badge>
        </div>

        <h1 className="mt-3 font-heading text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
          {mk.nama}
        </h1>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Meta
            label={k.dokumenPublik.metaProdi}
            nilai={`${namaProdi} (${rpkps.prodi.jenjang})`}
          />
          <Meta label={k.dokumenPublik.metaBeban} nilai={ringkasSks(mk)} mono />
          <Meta
            label={k.dokumenPublik.metaTahunAkademik}
            nilai={labelTahunAkademik(rpkps.tahunAkademik)}
            mono
          />
          <Meta
            label={k.dokumenPublik.metaKurikulum}
            nilai={`${rpkps.kurikulum.nama} (${rpkps.kurikulum.tahun})`}
          />
        </dl>

        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <ButtonLink
            href={`/api/publik/rpkps/${rpkps.id}/docx?bahasa=${b}`}
            prefetch={false}
          >
            <Download />
            {k.dokumenPublik.unduh}
          </ButtonLink>
          {/*
            Berkas bahasa yang satunya selalu ditawarkan. Yang berbahasa
            Indonesia adalah naskah yang sah, jadi pembaca Inggris harus dapat
            mengambilnya tanpa berganti bahasa antarmuka lebih dulu.
          */}
          <ButtonLink
            variant="outline"
            href={`/api/publik/rpkps/${rpkps.id}/docx?bahasa=${b === "id" ? "en" : "id"}`}
            prefetch={false}
          >
            <Download />
            {k.dwibahasa.unduhBahasaLain}
          </ButtonLink>
          <TombolCetak />
        </div>

        {rpkps.versiLain.length > 1 ? (
          <div className="mt-6 print:hidden">
            <p className="label-teknis mb-2 text-muted-foreground/70">
              {k.dokumenPublik.tahunLain}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rpkps.versiLain.map((kodeTa) => {
                const aktif = kodeTa === rpkps.tahunAkademik;
                return (
                  <Tautan
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
                  </Tautan>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <PitaSidik
        sidik={rpkps.sidik}
        sidikEn={b === "id" ? null : rpkps.sidikEn}
        versi={rpkps.versi}
        disahkanPada={rpkps.disahkanPada}
        k={k}
        b={b}
      />

      <KeteranganVersi tanpaVersiEn={tanpaVersiEn} bahasa={b} k={k} />

      <div className="gap-10 xl:grid xl:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <DaftarIsi butir={daftarIsi} />
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          <Bagian
            id="deskripsi"
            judul={k.dokumenPublik.bagian.deskripsiJudul}
            keterangan={k.dokumenPublik.bagian.deskripsiKeterangan}
          >
            <BagianDeskripsi dok={dok} />
          </Bagian>

          <Bagian
            id="capaian"
            judul={k.dokumenPublik.bagian.capaianJudul}
            keterangan={k.dokumenPublik.bagian.capaianKeterangan}
          >
            <BagianCapaian dok={dok} />
          </Bagian>

          <Bagian
            id="mingguan"
            judul={k.dokumenPublik.bagian.mingguanJudul}
            keterangan={k.dokumenPublik.bagian.mingguanKeterangan}
          >
            <BagianMingguan dok={dok} />
          </Bagian>

          {dok.tugas.length > 0 ? (
            <Bagian
              id="tugas"
              judul={k.dokumenPublik.bagian.tugasJudul}
              keterangan={k.dokumenPublik.bagian.tugasKeterangan}
            >
              <BagianTugas dok={dok} />
            </Bagian>
          ) : null}

          <Bagian
            id="penilaian"
            judul={k.dokumenPublik.bagian.penilaianJudul}
            keterangan={k.dokumenPublik.bagian.penilaianKeterangan}
          >
            <BagianPenilaian dok={dok} />
          </Bagian>

          <Bagian id="pustaka" judul={k.dokumenPublik.bagian.pustakaJudul}>
            <BagianPustaka dok={dok} />
          </Bagian>

          <Bagian id="pengampu" judul={k.dokumenPublik.bagian.pengampuJudul}>
            <BagianPengampu dok={dok} />
          </Bagian>

          {/*
            Pengesahan berdiri sebagai bagiannya sendiri, bukan baris di pita
            atas: pita menjawab "isi mana ini", bagian ini menjawab "siapa yang
            bertanggung jawab atasnya". Keduanya menyebut sidik yang sama, dan
            itu memang inti pembuktiannya.
          */}
          <Bagian
            id="pengesahan"
            judul={k.dokumenPublik.bagian.pengesahanJudul}
            keterangan={k.dokumenPublik.bagian.pengesahanKeterangan}
          >
            <BagianPengesah pengesah={rpkps.pengesah} />
          </Bagian>

          {rpkps.riwayat.length > 0 ? (
            <Bagian
              id="riwayat"
              judul={k.dokumenPublik.bagian.riwayatJudul}
              keterangan={k.dokumenPublik.bagian.riwayatKeterangan}
            >
              <Panel>
                <ol className="space-y-3">
                  {rpkps.riwayat.map((r, i) => (
                    <li key={i} className="flex gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {tanggal(r.dibuatPada, b, "panjang")}
                      </span>
                      <span className="min-w-0">
                        <Badge variant="outline" className="mr-2 font-mono text-[10px]">
                          v{r.versi}
                        </Badge>
                        {teksRiwayat(r.data ?? null, r.deskripsi, k)}
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
  sidikEn,
  versi,
  disahkanPada,
  k,
  b,
}: {
  sidik: string;
  /** Sidik ruang KEDUA. Ditampilkan berdampingan, tidak menggantikan. */
  sidikEn: string | null;
  versi: number;
  disahkanPada: Date;
  k: Kamus;
  b: Bahasa;
}) {
  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <ShieldCheck className="size-5 shrink-0 text-success" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">
          {isi(k.dokumenPublik.disahkan, {
            tanggal: tanggal(disahkanPada, b, "panjang"),
          })}
        </span>
        <span className="text-muted-foreground">
          {isi(k.dokumenPublik.disahkanVersi, { versi })}
        </span>
      </p>
      <code
        title={sidik}
        className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
      >
        {sidikRingkas(sidik)}
      </code>
      {/*
        Dua sidik, dua ruang. Yang Inggris TIDAK menggantikan yang Indonesia:
        dokumen yang ditandatangani adalah yang Indonesia, dan sidiknya harus
        tetap dapat dibandingkan dengan berkas DOCX yang dipegang orang.
      */}
      {sidikEn ? (
        <code
          title={`${k.dokumenPublik.versiInggris.sidikEn}: ${sidikEn}`}
          className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
        >
          EN {sidikRingkas(sidikEn)}
        </code>
      ) : null}
    </div>
  );
}

/**
 * Keterangan versi bahasa, hanya untuk pembaca Inggris.
 *
 * Dua kalimat, dan keduanya perlu: bahwa versi Inggris belum diterbitkan (atau
 * belum lengkap), DAN bahwa versi Indonesia adalah yang sah. Yang kedua yang
 * paling penting — halaman ini dokumen resmi, dan pembaca berhak tahu versi
 * mana yang berlaku bila keduanya berbeda (docs/11 §6.3).
 */
function KeteranganVersi({
  tanpaVersiEn,
  bahasa,
  k,
}: {
  tanpaVersiEn: boolean;
  bahasa: Bahasa;
  k: Kamus;
}) {
  if (bahasa === "id") return null;
  const v = k.dokumenPublik.versiInggris;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <Languages className="mt-0.5 size-4 shrink-0" />
      <p>
        {tanpaVersiEn ? v.belumTerbit : v.sebagian}{" "}
        <span className="font-medium text-foreground">{v.indonesiaYangSah}</span>
      </p>
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
