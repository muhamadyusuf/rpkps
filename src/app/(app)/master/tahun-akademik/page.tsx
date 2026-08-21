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
import { FormulirTahunAkademik, TombolAktifkanTahun } from "../formulir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tahun Akademik" };

const LABEL_SEMESTER = { GANJIL: "Ganjil", GENAP: "Genap", ANTARA: "Antara" } as const;

export default async function HalamanTahunAkademik() {
  await wajibPeran("ADMIN");

  const daftar = await prisma.tahunAkademik.findMany({
    orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Data master</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tahun Akademik</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Hanya satu tahun akademik yang aktif pada satu waktu. RPKPS baru
          otomatis mengikuti tahun aktif.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah tahun akademik</CardTitle>
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
                <TableHead>Tahun</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium tabular-nums">
                    {t.tahunMulai}/{t.tahunSelesai}
                  </TableCell>
                  <TableCell>{LABEL_SEMESTER[t.semester]}</TableCell>
                  <TableCell className="text-right">
                    {t.aktif ? (
                      <Badge>Aktif</Badge>
                    ) : (
                      <TombolAktifkanTahun id={t.id} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {daftar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Belum ada tahun akademik.
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
