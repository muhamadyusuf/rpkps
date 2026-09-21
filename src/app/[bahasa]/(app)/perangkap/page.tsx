import { ExternalLink } from "lucide-react";
import { Tautan } from "@/components/tautan";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KotakCari } from "@/components/kotak-cari";
import { Paginasi } from "@/components/paginasi";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";
import { ringkasPerangkap } from "@/lib/keamanan/ringkas";
import { tautanPeta } from "@/domain/keamanan/lokasi-ip";
import type { Prisma, StatusPerangkap } from "@/generated/prisma";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).perangkap.judul };
}

const STATUS: StatusPerangkap[] = ["BARU", "DITINJAU", "DILAPORKAN", "DIABAIKAN"];

export default async function HalamanPerangkap({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await wajibPeran("ADMIN");
  const [k, b] = await Promise.all([kamus(), bahasaAktif()]);

  const mentah = await searchParams;
  const kata = bacaKata(mentah.q);
  const statusMentah = Array.isArray(mentah.status) ? mentah.status[0] : mentah.status;
  const status = STATUS.find((s) => s === statusMentah);

  const saring: Prisma.PerangkapTemuanWhereInput = {
    ...(status ? { status } : {}),
    ...(kata
      ? {
          OR: [
            { ip: { contains: kata } },
            { jalur: { contains: kata, mode: "insensitive" } },
            { kota: { contains: kata, mode: "insensitive" } },
            { negara: { contains: kata, mode: "insensitive" } },
            { penyedia: { contains: kata, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [jumlah, { total, baru, duaEmpat, ipUnik }] = await Promise.all([
    prisma.perangkapTemuan.count({ where: saring }),
    ringkasPerangkap(),
  ]);

  const halaman = hitungHalaman(jumlah, bacaHalaman(mentah.hal), UKURAN_HALAMAN);
  const daftar = await prisma.perangkapTemuan.findMany({
    where: saring,
    orderBy: { terakhirPada: "desc" },
    skip: halaman.lewati,
    take: halaman.ambil,
    select: {
      id: true, ip: true, jenis: true, jalur: true, metode: true, jumlah: true,
      terakhirPada: true, status: true, kota: true, negara: true, kodeNegara: true,
      lintang: true, bujur: true, penyedia: true,
    },
  });

  const ringkas = [
    { label: k.perangkap.ringkas.duaEmpatJam, nilai: duaEmpat },
    { label: k.perangkap.ringkas.ipUnik, nilai: ipUnik },
    { label: k.perangkap.ringkas.baru, nilai: baru },
    { label: k.perangkap.ringkas.total, nilai: total },
  ];
  const paramsHalaman = { q: kata || undefined, status };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">{k.perangkap.eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{k.perangkap.judul}</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{k.perangkap.keterangan}</p>
        <KotakCari
          action="/perangkap"
          nilai={kata}
          placeholder={k.perangkap.cariPlaceholder}
          className="mt-4"
        />
        <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label={k.perangkap.kolom.status}>
          {[undefined, ...STATUS].map((s) => (
            <Tautan
              key={s ?? "semua"}
              href={s ? `/perangkap?status=${s}${kata ? `&q=${encodeURIComponent(kata)}` : ""}` : `/perangkap${kata ? `?q=${encodeURIComponent(kata)}` : ""}`}
              className={
                s === status
                  ? "rounded-md bg-primary px-2.5 py-1 text-primary-foreground"
                  : "rounded-md border border-border px-2.5 py-1 hover:bg-muted"
              }
            >
              {s ? k.perangkap.status[s] : k.perangkap.semuaStatus}
            </Tautan>
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ringkas.map((r) => (
          <Card key={r.label}>
            <CardHeader className="pb-1">
              <CardDescription>{r.label}</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">{r.nilai}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">{k.perangkap.catatanLokasi}</p>

      <Card>
        <CardContent className="pt-6">
          {daftar.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{k.perangkap.kosong}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{k.perangkap.kolom.waktu}</TableHead>
                    <TableHead>{k.perangkap.kolom.ip}</TableHead>
                    <TableHead>{k.perangkap.kolom.lokasi}</TableHead>
                    <TableHead>{k.perangkap.kolom.sasaran}</TableHead>
                    <TableHead className="text-right">{k.perangkap.kolom.jumlah}</TableHead>
                    <TableHead>{k.perangkap.kolom.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daftar.map((t) => {
                    const peta = tautanPeta(t.lintang, t.bujur);
                    const lokasi = [t.kota, t.negara ?? t.kodeNegara].filter(Boolean).join(", ");
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {tanggal(t.terakhirPada, b, "waktu")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Tautan
                            href={`/perangkap/${t.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {t.ip}
                          </Tautan>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lokasi || <span className="text-muted-foreground">{k.perangkap.lokasiBelum}</span>}
                          {t.penyedia ? (
                            <span className="block text-muted-foreground">{t.penyedia}</span>
                          ) : null}
                          {peta ? (
                            <a
                              href={peta}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
                            >
                              {k.perangkap.lihatPeta}
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs">
                          <Badge variant="secondary">
                            {k.perangkap.jenis[t.jenis as keyof typeof k.perangkap.jenis] ?? t.jenis}
                          </Badge>
                          <code className="mt-1 block break-all font-mono">
                            {t.metode} {t.jalur}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">{t.jumlah}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "BARU" ? "destructive" : "outline"}>
                            {k.perangkap.status[t.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Paginasi halaman={halaman} basis="/perangkap" params={paramsHalaman} satuan="baris" />
    </div>
  );
}
