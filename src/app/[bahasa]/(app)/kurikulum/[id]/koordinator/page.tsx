import { notFound } from "next/navigation";
import { ArrowLeft, Search, SlidersHorizontal, UserRoundCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paginasi } from "@/components/paginasi";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import { bacaHalaman, bacaKata, hitungHalaman } from "@/lib/paginasi";
import {
  daftarCalonKoordinator,
  muatPapanPenugasan,
  saringPapan,
} from "@/lib/kurikulum/koordinator";
import { cn } from "@/lib/utils";
import { BarisPenugasan } from "./papan";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).kurikulum.koordinator.metaJudul };
}

/**
 * Papan penugasan koordinator mata kuliah — docs/13 §2.4.
 *
 * Ukuran halamannya lebih besar daripada daftar lain (50, bukan 25) karena
 * pekerjaannya berbeda: Kaprodi membagi MK sekaligus di awal semester sambil
 * menatap daftar lengkap, bukan menelusuri satu per satu. Penyaringan dan
 * pemenggalannya tetap di database — kurikulum besar tidak dimuat utuh hanya
 * untuk dibuang separuhnya di peramban.
 */
const UKURAN_PAPAN = 50;

export default async function HalamanKoordinatorMk({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;
  const mentah = await searchParams;

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    select: {
      id: true,
      nama: true,
      tahun: true,
      prodiId: true,
      prodi: { select: { nama: true, kode: true } },
    },
  });
  if (!kurikulum) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) notFound();

  // GPM sengaja hanya membaca: perannya mengawasi mutu, bukan membagi beban
  // mengajar (docs/13 §2.2).
  const bolehKelola = punyaPeranDiProdi(sesi, kurikulum.prodiId, "ADMIN", "KAPRODI");

  const daftarTa = await prisma.tahunAkademik.findMany({
    orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
    select: { id: true, kode: true, aktif: true },
  });

  const k = await kamus();

  if (daftarTa.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <ButtonLink variant="ghost" size="sm" href={`/kurikulum/${id}`}>
          <ArrowLeft />
          {kurikulum.nama}
        </ButtonLink>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {k.kurikulum.koordinator.tanpaTaJudul}
            </CardTitle>
            <CardDescription>{k.kurikulum.koordinator.tanpaTaIsi}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const diminta = Array.isArray(mentah.ta) ? mentah.ta[0] : mentah.ta;
  const ta =
    daftarTa.find((t) => t.id === diminta) ??
    daftarTa.find((t) => t.aktif) ??
    daftarTa[0];

  const kata = bacaKata(mentah.q);
  const hanyaKosong = (Array.isArray(mentah.kosong) ? mentah.kosong[0] : mentah.kosong) === "1";
  const saringan = {
    kurikulumId: id,
    tahunAkademikId: ta.id,
    kata,
    hanyaKosong,
  };

  const [jumlahMk, jumlahDitetapkan, jumlahCocok] = await Promise.all([
    prisma.mataKuliah.count({ where: { kurikulumId: id } }),
    prisma.koordinatorMk.count({
      where: { tahunAkademikId: ta.id, mataKuliah: { kurikulumId: id } },
    }),
    prisma.mataKuliah.count({ where: saringPapan(saringan) }),
  ]);

  const halaman = hitungHalaman(jumlahCocok, bacaHalaman(mentah.hal), UKURAN_PAPAN);

  const [baris, calon] = await Promise.all([
    muatPapanPenugasan({ ...saringan, lewati: halaman.lewati, ambil: halaman.ambil }),
    bolehKelola ? daftarCalonKoordinator() : Promise.resolve([]),
  ]);

  const labelTa = ta.kode.replace("-", " ");
  const paramsPaginasi = {
    q: kata || undefined,
    ta: ta.id,
    kosong: hanyaKosong ? "1" : undefined,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/kurikulum/${id}`}>
          <ArrowLeft />
          {kurikulum.nama}
        </ButtonLink>
      </div>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.kurikulum.koordinator.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.kurikulum.koordinator.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isi(k.kurikulum.koordinator.ringkasan, {
            prodi: kurikulum.prodi.nama,
            kode: kurikulum.prodi.kode,
            ta: labelTa,
          })}
        </p>
        {/* Angkanya disebut karena yang dicari di halaman ini justru yang belum. */}
        <p className="mt-3 text-sm">
          <span className="font-medium tabular-nums">
            {isi(k.kurikulum.koordinator.hitungAwal, {
              ditetapkan: jumlahDitetapkan,
              total: jumlahMk,
            })}
          </span>{" "}
          {isi(k.kurikulum.koordinator.hitungAkhir, { ta: labelTa })}
          {jumlahDitetapkan < jumlahMk ? (
            <>
              {" "}
              <span className="text-muted-foreground">
                {isi(k.kurikulum.koordinator.belumDitetapkanJumlah, {
                  jumlah: jumlahMk - jumlahDitetapkan,
                })}
              </span>
            </>
          ) : null}
        </p>
      </header>

      <form
        action={`/kurikulum/${id}/koordinator`}
        className="panel rounded-xl border bg-card p-3 md:p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <LabelKecil htmlFor="q">{k.kurikulum.koordinator.cari}</LabelKecil>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                type="search"
                name="q"
                defaultValue={kata}
                placeholder={k.kurikulum.koordinator.cariPlaceholder}
                className="pl-9"
              />
            </div>
          </div>

          <div className="min-w-48">
            <LabelKecil htmlFor="ta">{k.kurikulum.koordinator.tahunAkademik}</LabelKecil>
            <Pilihan id="ta" nama="ta" nilai={ta.id}>
              {daftarTa.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.kode.replace("-", " ")}
                  {t.aktif ? k.kurikulum.koordinator.taAktif : ""}
                </option>
              ))}
            </Pilihan>
          </div>

          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="kosong"
              value="1"
              defaultChecked={hanyaKosong}
              className="size-4 rounded border-input accent-primary"
            />
            {k.kurikulum.koordinator.hanyaKosong}
          </label>

          <Button type="submit" variant="outline">
            <SlidersHorizontal />
            {k.kurikulum.koordinator.terapkan}
          </Button>
        </div>
      </form>

      {!bolehKelola ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <UserRoundCog className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  {k.kurikulum.koordinator.bacaSajaJudul}
                </CardTitle>
                <CardDescription className="mt-1">
                  {k.kurikulum.koordinator.bacaSajaIsi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{k.kurikulum.koordinator.kolomMk}</TableHead>
                  <TableHead>
                    {isi(k.kurikulum.koordinator.kolomKoordinator, { ta: labelTa })}
                  </TableHead>
                  <TableHead>{k.kurikulum.koordinator.kolomRpkps}</TableHead>
                  {bolehKelola ? (
                    <TableHead className="text-right">
                      {k.kurikulum.koordinator.kolomTetapkan}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => (
                  <BarisPenugasan
                    key={b.mataKuliahId}
                    baris={{
                      mataKuliahId: b.mataKuliahId,
                      kurikulumId: id,
                      kode: b.kode,
                      nama: b.nama,
                      namaEn: b.namaEn,
                      semester: b.semester,
                      sks: b.sks,
                      koordinator: b.koordinator,
                      ditetapkanOleh: b.ditetapkanOleh,
                      rpkps: b.rpkps,
                    }}
                    tahunAkademikId={ta.id}
                    labelTa={labelTa}
                    calon={calon}
                    bolehKelola={bolehKelola}
                  />
                ))}
                {baris.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={bolehKelola ? 4 : 3}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {hanyaKosong && !kata
                        ? isi(k.kurikulum.koordinator.semuaTerisi, { ta: labelTa })
                        : k.kurikulum.koordinator.tidakCocok}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <Paginasi
            className="mt-4"
            halaman={halaman}
            basis={`/kurikulum/${id}/koordinator`}
            params={paramsPaginasi}
            satuan="mataKuliah"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kurikulum.koordinator.dampakJudul}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <Badge variant="outline" className="mr-1.5 text-[10px]">
              {k.kurikulum.koordinator.dampakTanpaRpkps}
            </Badge>
            {isi(k.kurikulum.koordinator.dampakTanpaRpkpsIsi, { ta: labelTa })}
          </p>
          <p>
            <Badge variant="outline" className="mr-1.5 text-[10px]">
              {k.kurikulum.koordinator.dampakAdaRpkps}
            </Badge>
            {k.kurikulum.koordinator.dampakAdaRpkpsIsi}
          </p>
          <p>
            <Badge variant="outline" className="mr-1.5 text-[10px]">
              {k.kurikulum.koordinator.dampakDilepas}
            </Badge>
            {k.kurikulum.koordinator.dampakDilepasIsi}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LabelKecil({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="label-teknis mb-1.5 block text-muted-foreground/80">
      {children}
    </label>
  );
}

/**
 * `<select>` bawaan, bukan komponen Select milik Base UI: penyaring ini adalah
 * formulir GET biasa supaya hasilnya dapat disalin sebagai tautan — pola yang
 * sama dengan penyaring katalog publik.
 */
function Pilihan({
  id,
  nama,
  nilai,
  children,
}: {
  id: string;
  nama: string;
  nilai: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={nama}
        defaultValue={nilai}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-card py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,border-color] duration-200 outline-none",
          "hover:border-cahaya/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
          "dark:bg-input/30",
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute top-1/2 right-3 h-1.5 w-2.5 -translate-y-1/2 text-muted-foreground"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
