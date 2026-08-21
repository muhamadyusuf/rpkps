import Link from "next/link";
import { FileText } from "lucide-react";
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
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { TombolBuatRpkps } from "./tombol";

export const dynamic = "force-dynamic";
export const metadata = { title: "RPKPS" };

const LABEL_STATUS: Record<string, string> = {
  DRAF: "Draf",
  DIAJUKAN: "Diajukan",
  DIREVISI: "Perlu revisi",
  DISETUJUI: "Disetujui",
  TERBIT: "Terbit",
  ARSIP: "Arsip",
};

export default async function HalamanRpkps() {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const [tahunAktif, daftar, mkBelumPunya] = await Promise.all([
    prisma.tahunAkademik.findFirst({ where: { aktif: true } }),
    prisma.rpkps.findMany({
      where: { mataKuliah: { kurikulum: filterProdi } },
      orderBy: [{ diubahPada: "desc" }],
      include: {
        mataKuliah: { select: { kode: true, nama: true, sksTeori: true, sksPraktik: true } },
        tahunAkademik: { select: { kode: true } },
        _count: { select: { pertemuan: true } },
      },
    }),
    prisma.mataKuliah.findMany({
      where: {
        kurikulum: { status: "BERLAKU", ...filterProdi },
        cpmk: { some: {} },
      },
      orderBy: [{ semester: "asc" }, { kode: "asc" }],
      select: { id: true, kode: true, nama: true, semester: true, rpkps: { select: { tahunAkademikId: true } } },
    }),
  ]);

  const belum = tahunAktif
    ? mkBelumPunya.filter((mk) => !mk.rpkps.some((r) => r.tahunAkademikId === tahunAktif.id))
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Modul</p>
        <h1 className="text-2xl font-semibold tracking-tight">RPKPS</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tahunAktif
            ? `Tahun akademik aktif: ${tahunAktif.kode.replace("-", " ")}`
            : "Belum ada tahun akademik aktif — tetapkan lebih dulu di master data."}
        </p>
      </header>

      {daftar.length === 0 && belum.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Belum ada RPKPS</CardTitle>
                <CardDescription className="mt-1">
                  RPKPS disusun di atas kurikulum yang sudah berlaku. Pastikan
                  kurikulum sudah diimpor dan statusnya Berlaku, serta mata
                  kuliahnya sudah memiliki CPMK.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {daftar.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mata kuliah</TableHead>
                    <TableHead>Tahun akademik</TableHead>
                    <TableHead className="text-center">Pertemuan</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daftar.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/rpkps/${r.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {r.mataKuliah.kode} — {r.mataKuliah.nama}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.mataKuliah.sksTeori + r.mataKuliah.sksPraktik} sks (
                          {r.mataKuliah.sksTeori}T+{r.mataKuliah.sksPraktik}P) · versi {r.versi}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.tahunAkademik.kode.replace("-", " ")}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {r._count.pertemuan}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            r.status === "TERBIT"
                              ? "default"
                              : r.status === "DIREVISI"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {LABEL_STATUS[r.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tahunAktif && belum.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mata kuliah belum punya RPKPS ({belum.length})
            </CardTitle>
            <CardDescription>
              Kerangka 16 pertemuan, alokasi waktu, dan penjadwalan Sub-CPMK
              disusun otomatis saat dibuat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {belum.map((mk) => (
                <div
                  key={mk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {mk.kode} — {mk.nama}
                    </p>
                    <p className="text-xs text-muted-foreground">Semester {mk.semester}</p>
                  </div>
                  <TombolBuatRpkps mataKuliahId={mk.id} tahunAkademikId={tahunAktif.id} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
