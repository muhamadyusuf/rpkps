"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  praTinjauImporPengguna,
  simpanImporPengguna,
  type HasilPraTinjauPengguna,
} from "../aksi";

export function FormulirImporPengguna() {
  const [pratinjau, setPratinjau] = useState<HasilPraTinjauPengguna | null>(null);
  const [memeriksa, mulaiPeriksa] = useTransition();
  const [menyimpan, mulaiSimpan] = useTransition();
  const router = useRouter();
  const { jalur, k, isi } = useBahasa();

  const siap = pratinjau?.siap ?? [];
  const galat = pratinjau?.galat ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.pengguna.impor.langkah1}</CardTitle>
          <CardDescription>{k.pengguna.impor.langkah1Keterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink variant="outline" href="/api/pengguna/template">
            <Download />
            {k.pengguna.impor.unduhTemplate}
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.pengguna.impor.langkah2}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              mulaiPeriksa(async () => {
                const hasil = await praTinjauImporPengguna(data);
                if (!hasil.ok) {
                  toast.error(hasil.pesan);
                  setPratinjau(null);
                  return;
                }
                setPratinjau(hasil);
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="berkas">{k.pengguna.impor.berkasXlsx}</Label>
              <Input id="berkas" name="berkas" type="file" accept=".xlsx" required />
            </div>
            <Button type="submit" disabled={memeriksa}>
              {memeriksa ? k.pengguna.impor.memeriksa : k.pengguna.impor.periksaBerkas}
            </Button>
          </form>
        </CardContent>
      </Card>

      {pratinjau ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.pengguna.impor.langkah3}</CardTitle>
            <CardDescription>
              {siap.length > 0
                ? isi(k.pengguna.impor.siapDitambahkan, { jumlah: siap.length })
                : k.pengguna.impor.tanpaBarisSiap}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {siap.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{k.pengguna.impor.kolomBaris}</TableHead>
                      <TableHead>{k.pengguna.impor.kolomEmail}</TableHead>
                      <TableHead>{k.pengguna.impor.kolomNama}</TableHead>
                      <TableHead>{k.pengguna.impor.kolomPeran}</TableHead>
                      <TableHead>{k.pengguna.impor.kolomProdi}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {siap.map((b) => (
                      <TableRow key={b.baris}>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {b.baris}
                        </TableCell>
                        <TableCell className="text-sm">{b.email}</TableCell>
                        <TableCell className="text-sm">{b.nama}</TableCell>
                        <TableCell>
                          {b.peran ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {k.enum.peran[b.peran]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {k.pengguna.tambah.tanpaPeran}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.prodiKode ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {galat.length > 0 ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <TriangleAlert className="size-4 shrink-0 text-destructive" />
                  {isi(k.pengguna.impor.barisGagal, { jumlah: galat.length })}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {galat.slice(0, 12).map((g, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {isi(k.pengguna.impor.barisLokasi, { baris: g.baris })}
                      </span>{" "}
                      — {g.pesan}
                    </li>
                  ))}
                  {galat.length > 12 ? (
                    <li className="text-muted-foreground">
                      {isi(k.pengguna.impor.lainnya, { jumlah: galat.length - 12 })}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {siap.length > 0 && galat.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                {isi(k.pengguna.impor.siapDitambahkan, { jumlah: siap.length })}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button
                disabled={siap.length === 0 || menyimpan}
                onClick={() =>
                  mulaiSimpan(async () => {
                    const hasil = await simpanImporPengguna(siap);
                    if (hasil.ok) {
                      toast.success(hasil.pesan);
                      router.push(jalur("/pengguna"));
                      router.refresh();
                    } else {
                      toast.error(hasil.pesan);
                    }
                  })
                }
              >
                <Upload />
                {menyimpan
                  ? k.pengguna.impor.menyimpan
                  : isi(k.pengguna.impor.simpan, { jumlah: siap.length })}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
