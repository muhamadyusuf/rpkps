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
import { FormulirTahunAkademik, KolomTenggat, TombolAktifkanTahun } from "../formulir";
import { kamus } from "@/lib/bahasa/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).master.tahun.metaJudul };
}

/** yyyy-mm-dd waktu setempat — bukan toISOString, yang menggeser ke UTC. */
function tanggalIso(t: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export default async function HalamanTahunAkademik() {
  await wajibPeran("ADMIN");
  const k = await kamus();

  const daftar = await prisma.tahunAkademik.findMany({
    orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.master.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.master.tahun.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.master.tahun.keterangan}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.master.tahun.tambah}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormulirTahunAkademik />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{k.master.tahun.kolomTahun}</TableHead>
                <TableHead>{k.master.tahun.kolomSemester}</TableHead>
                <TableHead>{k.master.tahun.kolomTenggatPenyusunan}</TableHead>
                <TableHead>{k.master.tahun.kolomTenggatReview}</TableHead>
                <TableHead>{k.master.tahun.kolomTenggatPengesahan}</TableHead>
                <TableHead className="text-right">{k.master.tahun.kolomStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium tabular-nums">
                    {t.tahunMulai}/{t.tahunSelesai}
                  </TableCell>
                  <TableCell>{k.enum.semester[t.semester]}</TableCell>
                  <TableCell>
                    <KolomTenggat
                      id={t.id}
                      jenis="PENYUSUNAN"
                      label={k.master.tahun.ariaTenggatPenyusunan}
                      awal={t.tenggatPenyusunan ? tanggalIso(t.tenggatPenyusunan) : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <KolomTenggat
                      id={t.id}
                      jenis="REVIEW"
                      label={k.master.tahun.ariaTenggatReview}
                      awal={t.tenggatReview ? tanggalIso(t.tenggatReview) : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <KolomTenggat
                      id={t.id}
                      jenis="PENGESAHAN"
                      label={k.master.tahun.ariaTenggatPengesahan}
                      awal={t.tenggatPengesahan ? tanggalIso(t.tenggatPengesahan) : ""}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {t.aktif ? (
                      <Badge>{k.master.tahun.aktif}</Badge>
                    ) : (
                      <TombolAktifkanTahun id={t.id} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {daftar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {k.master.tahun.kosong}
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
