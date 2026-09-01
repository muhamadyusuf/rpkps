import { CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import type { Kebijakan } from "@/domain/beban-belajar/tipe";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { KalkulatorInteraktif } from "./kalkulator-interaktif";
import { TombolBerlakukan } from "./tombol-berlakukan";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).kebijakan.metaJudul };
}

export default async function HalamanKebijakan() {
  await wajibPeran("ADMIN", "GPM");
  const k = await kamus();

  const baris = await prisma.kebijakanBebanBelajar.findFirst({
    orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
    include: { bentuk: { orderBy: { bentuk: "asc" } } },
  });

  if (!baris) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.kebijakan.kosongJudul}</CardTitle>
            <CardDescription>
              {k.kebijakan.kosongIsiAwal}{" "}
              <code className="rounded bg-muted px-1">npm run db:seed</code>{" "}
              {k.kebijakan.kosongIsiAkhir}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Decimal dari Prisma diubah ke number agar dapat dikirim ke komponen klien.
  const kebijakan: Kebijakan = {
    mingguPerSemester: baris.mingguPerSemester,
    pertemuanEfektifTeori: baris.pertemuanEfektifTeori,
    pertemuanEfektifPraktik: baris.pertemuanEfektifPraktik,
    hitungMingguUjian: baris.hitungMingguUjian,
    menitTmPerUjian: baris.menitTmPerUjian,
    jamPerSksPerSemester: Number(baris.jamPerSksPerSemester),
    toleransiSemesterPersen: Number(baris.toleransiSemesterPersen),
    toleransiPertemuanPersen: Number(baris.toleransiPertemuanPersen),
    bentuk: baris.bentuk.map((b) => ({
      bentuk: b.bentuk,
      tm: b.menitTmPerSks,
      pt: b.menitPtPerSks,
      bm: b.menitBmPerSks,
      tmTerjadwal: b.tmTerjadwal,
      butuhRuangKhusus: b.butuhRuangKhusus,
    })),
  };

  const par = k.kebijakan.param;
  const parameter = [
    [par.mingguPerSemester, baris.mingguPerSemester],
    [par.pertemuanTeori, baris.pertemuanEfektifTeori],
    [par.pertemuanPraktik, baris.pertemuanEfektifPraktik],
    [par.jamPerSks, isi(par.jam, { nilai: Number(baris.jamPerSksPerSemester) })],
    [par.menitTmUjian, isi(par.menit, { nilai: baris.menitTmPerUjian })],
    [par.toleransiSemester, `±${Number(baris.toleransiSemesterPersen)}%`],
    [par.toleransiPertemuan, `±${Number(baris.toleransiPertemuanPersen)}%`],
    [par.hitungMingguUjian, baris.hitungMingguUjian ? par.ya : par.tidak],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.kebijakan.eyebrow}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {k.kebijakan.judul}
          </h1>
          <Badge variant={baris.status === "BERLAKU" ? "default" : "outline"}>
            {k.enum.statusKurikulum[baris.status]}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{baris.nama}</p>
      </header>

      {baris.status === "DRAF" ? (
        <Card className="border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{k.kebijakan.perluKonfirmasi}</CardTitle>
                <CardDescription className="mt-1">
                  {baris.catatan ?? k.kebijakan.catatanBawaan}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TombolBerlakukan kebijakanId={baris.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kebijakan.parameterJudul}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {parameter.map(([label, nilai]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b pb-2">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium tabular-nums">{nilai}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kebijakan.menitJudul}</CardTitle>
          <CardDescription>{k.kebijakan.menitKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{k.kebijakan.kolomBentuk}</TableHead>
                  <TableHead className="text-right">TM</TableHead>
                  <TableHead className="text-right">PT</TableHead>
                  <TableHead className="text-right">BM</TableHead>
                  <TableHead className="text-right">{k.kebijakan.kolomTotal}</TableHead>
                  <TableHead>{k.kebijakan.kolomSifat}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.bentuk.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {k.enum.bentukPembelajaran[b.bentuk] ?? b.bentuk}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.menitTmPerSks}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.menitPtPerSks}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.menitBmPerSks}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {b.menitTmPerSks + b.menitPtPerSks + b.menitBmPerSks}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {b.tmTerjadwal ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {k.kebijakan.terjadwal}
                          </Badge>
                        ) : null}
                        {b.butuhRuangKhusus ? (
                          <Badge variant="outline" className="text-[10px]">
                            {k.kebijakan.ruangKhusus}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <KalkulatorInteraktif kebijakan={kebijakan} />
    </div>
  );
}
