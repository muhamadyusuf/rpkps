import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FormulirProdi, SakelarProdi } from "../formulir";
import { kamus } from "@/lib/bahasa/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).master.prodi.metaJudul };
}

export default async function HalamanProdi() {
  await wajibPeran("ADMIN");
  const k = await kamus();

  const daftar = await prisma.prodi.findMany({
    orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    include: {
      fakultas: { select: { kode: true } },
      _count: { select: { penugasan: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.master.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.master.prodi.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.master.prodi.keterangan}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.master.prodi.tambah}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormulirProdi />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{k.master.prodi.kolomNama}</TableHead>
                <TableHead>{k.master.prodi.kolomKode}</TableHead>
                <TableHead>{k.master.prodi.kolomJenjang}</TableHead>
                <TableHead className="text-right">{k.master.prodi.kolomPengguna}</TableHead>
                <TableHead className="text-right">{k.master.prodi.kolomAksi}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((p) => (
                <TableRow key={p.id} className={p.aktif ? undefined : "opacity-50"}>
                  <TableCell className="font-medium">
                    {p.nama}
                    {p.gelar ? (
                      <span className="ml-2 text-xs text-muted-foreground">{p.gelar}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.kode}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{p.jenjang}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {p._count.penugasan}
                  </TableCell>
                  <TableCell className="text-right">
                    <SakelarProdi id={p.id} aktif={p.aktif} />
                  </TableCell>
                </TableRow>
              ))}
              {daftar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {k.master.prodi.kosong}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
