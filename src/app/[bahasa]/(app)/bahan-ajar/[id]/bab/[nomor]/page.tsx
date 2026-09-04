import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { muatBuku, sidikSekarang } from "@/lib/bahan-ajar/muat";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { babBergeser } from "@/domain/bahan-ajar/sidik-sumber";
import { EditorBab } from "./editor";
import { PanelGambar } from "./panel-gambar";
import { PanelUsulan } from "../../panel-usulan";
import { aiTersediaUntuk } from "@/lib/ai/kredensial";

export const dynamic = "force-dynamic";

export default async function HalamanBab({
  params,
}: {
  params: Promise<{ id: string; nomor: string }>;
}) {
  const { id, nomor: nomorTeks } = await params;
  const nomor = Number(nomorTeks);
  if (!Number.isInteger(nomor)) notFound();

  const w = await wenangBuku(id);
  if (!w.ada || !w.bolehLihat) notFound();

  const buku = await muatBuku(id);
  const bab = buku?.bab.find((x) => x.nomor === nomor);
  if (!buku || !bab) notFound();

  const k = await kamus();
  // Kunci AI hanya ditanyakan bila tombolnya memang akan ada.
  const adaKunciAi = w.bolehTulis ? await aiTersediaUntuk(w.sesi.id) : false;
  const pertemuan = buku.rpkps.pertemuan.find((p) => p.id === bab.pertemuanId);
  const sidik = sidikSekarang(buku);
  const sekarang = bab.pertemuanId ? (sidik.get(bab.pertemuanId) ?? null) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Tautan
          href={`/bahan-ajar/${buku.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {k.bahanAjar.kembali}
        </Tautan>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {isi(k.bahanAjar.babEyebrow, { nomor: bab.nomor })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{bab.judul}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {pertemuan ? (
            <span>
              {isi(k.bahanAjar.sumberMinggu, {
                minggu: pertemuan.minggu,
                subCpmk:
                  pertemuan.subCpmk.map((s) => s.subCpmk.kode).join(", ") ||
                  k.bahanAjar.tanpaSubCpmk,
              })}
            </span>
          ) : (
            <Badge variant="destructive">{k.bahanAjar.babMingguHilang}</Badge>
          )}
          {babBergeser(bab.sidikSumber, sekarang) ? (
            <Badge variant="destructive">{k.bahanAjar.babBergeser}</Badge>
          ) : null}
        </p>
        {bab.alur ? (
          <p className="mt-2 text-sm text-muted-foreground italic">{bab.alur}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/api/bahan-ajar/${buku.id}/docx?bab=${bab.nomor}`}
            prefetch={false}
          >
            <FileDown className="size-4" />
            {k.bahanAjar.unduhBab}
          </ButtonLink>
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/api/bahan-ajar/${buku.id}/pptx?bab=${bab.nomor}`}
            prefetch={false}
          >
            <Presentation className="size-4" />
            {k.bahanAjar.unduhSlideBab}
          </ButtonLink>
        </div>
      </header>

      <EditorBab
        bukuId={buku.id}
        nomor={bab.nomor}
        bolehTulis={w.bolehTulis}
        adaUraian={Boolean(bab.uraian?.trim())}
        cap={bab.diubahPada.toISOString()}
        awal={{
          judul: bab.judul,
          tujuan: bab.tujuan,
          uraian: bab.uraian,
          studiKasus: bab.studiKasus,
          ringkasan: bab.ringkasan,
          latihan: bab.latihan.map((l) => ({ soal: l.soal, kunci: l.kunci })),
        }}
      />

      {/* Usulan untuk bab INI saja; tinjauan lintas bab ada di halaman buku. */}
      <PanelUsulan
        bukuId={buku.id}
        nomorBab={bab.nomor}
        bolehTulis={w.bolehTulis}
        adaKunciAi={adaKunciAi}
        usulan={buku.usulan
          .filter((u) => u.babId === bab.id)
          .map((u) => ({
            id: u.id,
            babNomor: bab.nomor,
            jenis: u.jenis,
            kutipan: u.kutipan,
            usul: u.usul,
            alasan: u.alasan,
          }))}
      />

      <PanelGambar
        bukuId={buku.id}
        nomorBab={bab.nomor}
        bolehTulis={w.bolehTulis}
        adaUraian={Boolean(bab.uraian?.trim())}
        adaKunciAi={adaKunciAi}
        gambar={bab.gambar.map((g) => ({
          id: g.id,
          nomor: g.nomor,
          judul: g.judul,
          altTeks: g.altTeks,
          letak: g.letak,
          sumber: g.sumber,
          bentuk: g.bentuk,
          kode: g.kode,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isi(k.bahanAjar.slideJudul, { jumlah: bab.slide.length })}
          </CardTitle>
          {bab.slide.length === 0 ? (
            <CardDescription>{k.bahanAjar.slideKosong}</CardDescription>
          ) : null}
        </CardHeader>
        {bab.slide.length > 0 ? (
          <CardContent>
            <ol className="space-y-3">
              {bab.slide.map((s) => (
                <li key={s.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {s.nomor}. {s.judul}
                  </p>
                  <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-sm text-muted-foreground">
                    {s.butir.map((butir, i) => (
                      <li key={i}>{butir}</li>
                    ))}
                  </ul>
                  {s.catatan ? (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      <span className="font-medium">{k.bahanAjar.slideCatatan}: </span>
                      {s.catatan}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
