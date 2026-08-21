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
import { LABEL_BENTUK } from "@/domain/beban-belajar/kebijakan-bawaan";
import type { Kebijakan } from "@/domain/beban-belajar/tipe";
import { KalkulatorInteraktif } from "./kalkulator-interaktif";
import { TombolBerlakukan } from "./tombol-berlakukan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beban Belajar" };

export default async function HalamanKebijakan() {
  await wajibPeran("ADMIN", "GPM");

  const baris = await prisma.kebijakanBebanBelajar.findFirst({
    orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
    include: { bentuk: { orderBy: { bentuk: "asc" } } },
  });

  if (!baris) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Belum ada kebijakan</CardTitle>
            <CardDescription>
              Jalankan <code className="rounded bg-muted px-1">npm run db:seed</code>{" "}
              untuk membuat kebijakan bawaan.
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

  const parameter = [
    ["Minggu per semester", baris.mingguPerSemester],
    ["Pertemuan efektif teori", baris.pertemuanEfektifTeori],
    ["Pertemuan efektif praktik", baris.pertemuanEfektifPraktik],
    ["Jam per sks per semester", `${Number(baris.jamPerSksPerSemester)} jam`],
    ["Menit TM pada minggu ujian", `${baris.menitTmPerUjian} menit`],
    ["Toleransi per semester", `±${Number(baris.toleransiSemesterPersen)}%`],
    ["Toleransi per pertemuan", `±${Number(baris.toleransiPertemuanPersen)}%`],
    ["Minggu ujian dihitung sebagai beban", baris.hitungMingguUjian ? "Ya" : "Tidak"],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Kebijakan</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Beban Belajar</h1>
          <Badge variant={baris.status === "BERLAKU" ? "default" : "outline"}>
            {baris.status === "BERLAKU"
              ? "Berlaku"
              : baris.status === "DRAF"
                ? "Draf"
                : "Arsip"}
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
                <CardTitle className="text-base">Perlu konfirmasi Penjaminan Mutu</CardTitle>
                <CardDescription className="mt-1">
                  {baris.catatan ??
                    "Angka masih bawaan dan belum dikonfirmasi institusi."}
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
          <CardTitle className="text-base">Parameter</CardTitle>
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
          <CardTitle className="text-base">Menit per sks per minggu</CardTitle>
          <CardDescription>
            Semua bentuk berjumlah 170 menit — bentuk pembelajaran mengubah
            komposisi, bukan total. Kolom TM dipakai untuk kebutuhan slot ruang;
            jumlah ketiganya dipakai untuk kepatuhan 45 jam per sks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bentuk</TableHead>
                  <TableHead className="text-right">TM</TableHead>
                  <TableHead className="text-right">PT</TableHead>
                  <TableHead className="text-right">BM</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Sifat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.bentuk.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {LABEL_BENTUK[b.bentuk] ?? b.bentuk}
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
                          <Badge variant="secondary" className="text-[10px]">terjadwal</Badge>
                        ) : null}
                        {b.butuhRuangKhusus ? (
                          <Badge variant="outline" className="text-[10px]">ruang khusus</Badge>
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
