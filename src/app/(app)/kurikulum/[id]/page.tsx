import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { TombolHapusKurikulum, TombolStatusKurikulum } from "../tombol";

export const dynamic = "force-dynamic";

export default async function HalamanDetailKurikulum({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    include: {
      prodi: { select: { id: true, nama: true, kode: true } },
      cpl: {
        orderBy: { urutan: "asc" },
        include: { _count: { select: { mataKuliah: true, cpmk: true } } },
      },
      mataKuliah: {
        orderBy: [{ semester: "asc" }, { kode: "asc" }],
        include: {
          cpl: { include: { cpl: { select: { kode: true } } } },
          _count: { select: { cpmk: true } },
        },
      },
    },
  });

  if (!kurikulum) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) notFound();

  const bolehKelola = punyaPeran(sesi, "ADMIN", "KAPRODI");

  // CPL yang tidak dibebankan pada mata kuliah mana pun tidak akan pernah
  // tercapai — ditandai di sini agar terlihat sebelum RPKPS disusun.
  const cplYatim = kurikulum.cpl.filter((c) => c._count.mataKuliah === 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/kurikulum">
          <ArrowLeft />
          Kurikulum
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{kurikulum.nama}</h1>
            <Badge variant={kurikulum.status === "BERLAKU" ? "default" : "outline"}>
              {kurikulum.status === "BERLAKU"
                ? "Berlaku"
                : kurikulum.status === "DRAF"
                  ? "Draf"
                  : "Arsip"}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {kurikulum.prodi.nama} ({kurikulum.prodi.kode}) · Tahun {kurikulum.tahun}
          </p>
        </div>
        {bolehKelola ? (
          <div className="flex flex-wrap gap-2">
            <TombolStatusKurikulum id={kurikulum.id} status={kurikulum.status} />
            {kurikulum.status !== "BERLAKU" ? (
              <TombolHapusKurikulum id={kurikulum.id} nama={kurikulum.nama} />
            ) : null}
          </div>
        ) : null}
      </header>

      {cplYatim.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">
              {cplYatim.length} CPL tidak dibebankan pada mata kuliah mana pun
            </CardTitle>
            <CardDescription className="mt-1">
              {cplYatim.map((c) => c.kode).join(", ")} — CPL seperti ini tidak
              akan pernah dicapai mahasiswa.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Capaian Pembelajaran Lulusan ({kurikulum.cpl.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {kurikulum.cpl.map((c) => (
            <div key={c.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{c.kode}</Badge>
                {c.tingkatKkni ? (
                  <span className="text-xs text-muted-foreground">
                    KKNI {c.tingkatKkni}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {c._count.mataKuliah} mata kuliah · {c._count.cpmk} CPMK
                </span>
              </div>
              <p className="mt-1 text-sm">{c.deskripsi}</p>
            </div>
          ))}
          {kurikulum.cpl.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada CPL.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Mata Kuliah ({kurikulum.mataKuliah.length})
          </CardTitle>
          <CardDescription>
            Kolom sks dipecah teori dan praktik — totalnya sama, tetapi beban
            terjadwalnya berbeda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-center">Smt</TableHead>
                  <TableHead className="text-center">sks (T+P)</TableHead>
                  <TableHead>CPL</TableHead>
                  <TableHead className="text-right">CPMK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kurikulum.mataKuliah.map((mk) => (
                  <TableRow key={mk.id}>
                    <TableCell>
                      <Link
                        href={`/kurikulum/${kurikulum.id}/mk/${mk.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {mk.kode}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{mk.nama}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {mk.semester}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {mk.sksTeori + mk.sksPraktik}
                      <span className="text-muted-foreground">
                        {" "}
                        ({mk.sksTeori}+{mk.sksPraktik})
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {mk.cpl.map((m) => (
                          <Badge key={m.cplId} variant="outline" className="text-[10px]">
                            {m.cpl.kode}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {mk._count.cpmk}
                    </TableCell>
                  </TableRow>
                ))}
                {kurikulum.mataKuliah.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada mata kuliah.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
