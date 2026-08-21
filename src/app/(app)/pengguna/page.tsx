import Link from "next/link";
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
import { LABEL_PERAN, wajibPeran } from "@/lib/otorisasi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengguna" };

const LABEL_STATUS = {
  AKTIF: "Aktif",
  NONAKTIF: "Nonaktif",
  MENUNGGU_VERIFIKASI: "Menunggu verifikasi",
} as const;

export default async function HalamanPengguna() {
  await wajibPeran("ADMIN");

  const daftar = await prisma.pengguna.findMany({
    orderBy: [{ status: "asc" }, { nama: "asc" }],
    include: {
      penugasan: { include: { prodi: { select: { kode: true } } } },
    },
  });

  const menunggu = daftar.filter((p) => p.status === "MENUNGGU_VERIFIKASI");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Administrasi</p>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Identitas login ditangani Google. NIDN/NIP, peran, dan program studi
          dikelola di sini.
        </p>
      </header>

      {menunggu.length > 0 ? (
        <Card className="border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <CardTitle className="text-base">
              {menunggu.length} akun menunggu verifikasi
            </CardTitle>
            <CardDescription>
              Pengguna baru belum punya peran dan belum dapat mengakses data
              akademik. Beri peran untuk mengaktifkannya.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIDN / NIP</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/pengguna/${p.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {[p.gelarDepan, p.nama, p.gelarBelakang].filter(Boolean).join(" ")}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {p.nidn ?? p.nip ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.penugasan.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            belum ada
                          </span>
                        ) : (
                          p.penugasan.map((t) => (
                            <Badge key={t.id} variant="secondary" className="text-[10px]">
                              {LABEL_PERAN[t.peran]}
                              {t.prodi ? ` · ${t.prodi.kode}` : ""}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "AKTIF"
                            ? "secondary"
                            : p.status === "NONAKTIF"
                              ? "outline"
                              : "default"
                        }
                        className="text-[10px]"
                      >
                        {LABEL_STATUS[p.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {daftar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada pengguna. Pengguna pertama dibuat otomatis saat login.
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
