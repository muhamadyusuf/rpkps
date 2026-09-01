import { Tautan } from "@/components/tautan";
import { BookUp, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { bacaSaringanUnit, muatUnit, prodiTersaring } from "@/lib/unit";
import { SaringanUnit } from "@/components/saringan-unit";
import { TombolStatusKurikulum } from "./tombol";
import { TombolKurikulumKosong } from "./kosong";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).kurikulum.metaJudul };
}

const WARNA_STATUS = {
  BERLAKU: "default",
  DRAF: "outline",
  ARSIP: "secondary",
} as const;

export default async function HalamanKurikulum({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const bolehImpor = punyaPeran(sesi, "ADMIN", "KAPRODI");
  const k = await kamus();

  /*
   * Saringan unit penyelenggara. Bagi ADMIN dan GPM daftar ini bercakupan
   * institusi — seluruh prodi sekaligus — sehingga tanpa penyaring, menemukan
   * kurikulum sebuah prodi berarti membaca seluruh halaman. `prodiTersaring`
   * menerjemahkan kode dari alamat menjadi id DARI DAFTAR yang sudah dibatasi
   * cakupan, jadi kode di luar wewenang tidak pernah menjadi id yang lolos.
   */
  const mentah = await searchParams;
  const saringan = bacaSaringanUnit(mentah);
  const unit = await muatUnit(cakupan);
  const terpilih = prodiTersaring(unit, saringan);
  const batasProdi = terpilih ?? cakupan;

  // Prodi yang boleh disusunkan kurikulum kosong. Hanya diambil bila memang
  // ada yang boleh menyusun — daftar prodi tidak berguna bagi pembaca biasa.
  const prodi = bolehImpor
    ? await prisma.prodi.findMany({
        where: { aktif: true, ...(cakupan === null ? {} : { id: { in: cakupan } }) },
        orderBy: { nama: "asc" },
        select: { id: true, nama: true, kode: true },
      })
    : [];

  const daftar = await prisma.kurikulum.findMany({
    where: batasProdi === null ? {} : { prodiId: { in: batasProdi } },
    orderBy: [{ tahun: "desc" }, { nama: "asc" }],
    include: {
      prodi: { select: { nama: true, kode: true } },
      _count: { select: { cpl: true, mataKuliah: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-teknis mb-2 text-muted-foreground/70">
            {k.kurikulum.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {k.kurikulum.judul}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {k.kurikulum.keterangan}
          </p>
        </div>
        {bolehImpor ? (
          <div className="flex flex-wrap gap-2">
            <TombolKurikulumKosong prodi={prodi} />
            <ButtonLink href="/kurikulum/impor">
              <Plus />
              {k.kurikulum.tombolImpor}
            </ButtonLink>
          </div>
        ) : null}
      </header>

      <SaringanUnit action="/kurikulum" unit={unit} nilai={saringan} />

      {daftar.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <BookUp className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{k.kurikulum.kosongJudul}</CardTitle>
                <CardDescription className="mt-1">
                  {k.kurikulum.kosongIsi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {bolehImpor ? (
            <CardContent className="flex flex-wrap gap-2">
              <ButtonLink variant="outline" href="/kurikulum/impor">
                {k.kurikulum.mulaiImpor}
              </ButtonLink>
              <TombolKurikulumKosong prodi={prodi} />
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-3">
          {daftar.map((kur) => (
            <Card key={kur.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tautan
                        href={`/kurikulum/${kur.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {kur.nama}
                      </Tautan>
                      <Badge variant={WARNA_STATUS[kur.status]}>
                        {k.enum.statusKurikulum[kur.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isi(k.kurikulum.ringkasan, {
                        prodi: kur.prodi.nama,
                        kode: kur.prodi.kode,
                        tahun: kur.tahun,
                        cpl: kur._count.cpl,
                        mk: kur._count.mataKuliah,
                      })}
                    </p>
                  </div>
                  {bolehImpor ? (
                    <TombolStatusKurikulum id={kur.id} status={kur.status} />
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
