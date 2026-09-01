import { Tautan } from "@/components/tautan";
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
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { KotakCari } from "@/components/kotak-cari";
import { Paginasi } from "@/components/paginasi";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).pengguna.judul };
}

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await wajibPeran("ADMIN");
  const k = await kamus();

  const mentah = await searchParams;
  const kata = bacaKata(mentah.q);

  // Dicari pada nama, surel, dan nomor induk sekaligus: admin datang ke sini
  // membawa salah satu dari ketiganya, dan biasanya tidak tahu yang lain.
  const saring = kata
    ? {
        OR: [
          { nama: { contains: kata, mode: "insensitive" as const } },
          { email: { contains: kata, mode: "insensitive" as const } },
          { nidn: { contains: kata, mode: "insensitive" as const } },
          { nip: { contains: kata, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Jumlah yang menunggu verifikasi dihitung atas SELURUH pengguna, tidak
  // mengikuti pencarian: peringatan itu tentang antrean kerja admin, bukan
  // tentang daftar yang sedang dilihatnya.
  const [jumlah, menunggu] = await Promise.all([
    prisma.pengguna.count({ where: saring }),
    prisma.pengguna.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
  ]);

  const halaman = hitungHalaman(jumlah, bacaHalaman(mentah.hal), UKURAN_HALAMAN);

  const daftar = await prisma.pengguna.findMany({
    where: saring,
    orderBy: [{ status: "asc" }, { nama: "asc" }],
    skip: halaman.lewati,
    take: halaman.ambil,
    include: {
      penugasan: { include: { prodi: { select: { kode: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.pengguna.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{k.pengguna.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{k.pengguna.keterangan}</p>
        <KotakCari
          action="/pengguna"
          nilai={kata}
          placeholder={k.pengguna.cariPlaceholder}
          className="mt-4"
        />
      </header>

      {menunggu > 0 ? (
        <Card className="border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.pengguna.menunggu.judul, { jumlah: menunggu })}
            </CardTitle>
            <CardDescription>{k.pengguna.menunggu.isi}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{k.pengguna.kolom.nama}</TableHead>
                  <TableHead>{k.pengguna.kolom.nomorInduk}</TableHead>
                  <TableHead>{k.pengguna.kolom.peran}</TableHead>
                  <TableHead>{k.pengguna.kolom.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Tautan
                        href={`/pengguna/${p.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {[p.gelarDepan, p.nama, p.gelarBelakang].filter(Boolean).join(" ")}
                      </Tautan>
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
                            {k.pengguna.belumAdaPeran}
                          </span>
                        ) : (
                          p.penugasan.map((t) => (
                            <Badge key={t.id} variant="secondary" className="text-[10px]">
                              {k.enum.peran[t.peran]}
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
                        {k.enum.statusPengguna[p.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {daftar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {kata ? isi(k.pengguna.tidakCocok, { kata }) : k.pengguna.kosong}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <Paginasi
            className="mt-4"
            halaman={halaman}
            basis="/pengguna"
            params={{ q: kata }}
            satuan="pengguna"
          />
        </CardContent>
      </Card>
    </div>
  );
}
