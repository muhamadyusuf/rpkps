import { Tautan } from "@/components/tautan";
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
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { KotakCari } from "@/components/kotak-cari";
import { Paginasi } from "@/components/paginasi";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";
import { FormulirTambahPengguna } from "./formulir-tambah";
import { TombolSinkronSemua } from "./tombol-sinkron";
import { env } from "@/lib/env";
import { cariPegawai } from "@/lib/identitas/pegawai";
import { tampilanDariRujukan } from "@/lib/pengguna/tampilan";

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

  // Nama, NIDN, dan NIP pegawai TIDAK ada di basis data ini (docs/26 §4), jadi pencarian
  // menanyakannya ke identitas-itts lebih dulu lalu memakai hasilnya sebagai kunci. Surel dan
  // nama pengguna LOKAL dicari di sini. Bila identitas-itts tak terjangkau, pencarian tetap
  // berjalan atas surel dan pengguna lokal — dan halaman berkata terus terang bahwa ia terbatas.
  let akunCocok: string[] = [];
  let pencarianTerbatas = false;
  if (kata && env.identitasItts) {
    try {
      akunCocok = (await cariPegawai(kata)).map((p) => p.akunId);
    } catch {
      pencarianTerbatas = true;
    }
  }
  const saring = kata
    ? {
        OR: [
          { email: { contains: kata, mode: "insensitive" as const } },
          { identitasAkunId: null, nama: { contains: kata, mode: "insensitive" as const } },
          ...(akunCocok.length > 0 ? [{ identitasAkunId: { in: akunCocok } }] : []),
        ],
      }
    : {};

  // Jumlah yang menunggu verifikasi dihitung atas SELURUH pengguna, tidak
  // mengikuti pencarian: peringatan itu tentang antrean kerja admin, bukan
  // tentang daftar yang sedang dilihatnya.
  const [jumlah, menunggu, prodi] = await Promise.all([
    prisma.pengguna.count({ where: saring }),
    prisma.pengguna.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
    prisma.prodi.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, kode: true },
    }),
  ]);

  const halaman = hitungHalaman(jumlah, bacaHalaman(mentah.hal), UKURAN_HALAMAN);

  // Urut status lalu surel: nama pegawai hidup di identitas-itts, tak dapat dipakai `ORDER BY`.
  const daftar = await prisma.pengguna.findMany({
    where: saring,
    orderBy: [{ status: "asc" }, { email: "asc" }],
    skip: halaman.lewati,
    take: halaman.ambil,
    select: {
      id: true,
      email: true,
      nama: true,
      identitasAkunId: true,
      status: true,
      penugasan: {
        select: { id: true, peran: true, sumber: true, prodi: { select: { kode: true } } },
        orderBy: { dibuatPada: "asc" },
      },
    },
  });

  // SATU pembacaan batch ke identitas-itts untuk seluruh halaman ini.
  const tampilan = await tampilanDariRujukan(daftar);
  const identitasPadam = [...tampilan.values()].some((t) => t.sumber === "TAK_DIKETAHUI");

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

      {identitasPadam || pencarianTerbatas ? (
        <Card className="border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <CardDescription>
              {identitasPadam ? k.pengguna.identitasPadam : k.pengguna.pencarianTanpaIdentitas}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{k.pengguna.tambah.judul}</CardTitle>
            <CardDescription>{k.pengguna.tambah.keterangan}</CardDescription>
          </div>
          <ButtonLink variant="outline" size="sm" href="/pengguna/impor">
            <Upload />
            {k.pengguna.imporTombol}
          </ButtonLink>
        </CardHeader>
        <CardContent>
          <FormulirTambahPengguna prodi={prodi} identitasAktif={env.identitasItts !== null} />
        </CardContent>
      </Card>

      {env.identitasItts ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{k.pengguna.sinkron.judul}</CardTitle>
              <CardDescription>{k.pengguna.sinkron.keterangan}</CardDescription>
            </div>
            <TombolSinkronSemua />
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
                {daftar.map((p) => {
                  const t = tampilan.get(p.id);
                  return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Tautan
                        href={`/pengguna/${p.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {t?.namaLengkap ?? p.email}
                      </Tautan>
                      <p className="text-xs text-muted-foreground">
                        {p.email} ·{" "}
                        {p.identitasAkunId ? k.pengguna.sumber.identitas : k.pengguna.sumber.lokal}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {t?.nidn ?? t?.nip ?? (
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
                          p.penugasan.map((u) => (
                            <Badge
                              key={u.id}
                              variant={u.sumber === "IDENTITAS" ? "outline" : "secondary"}
                              className="text-[10px]"
                              title={u.sumber === "IDENTITAS" ? k.pengguna.peranDariJabatan : undefined}
                            >
                              {k.enum.peran[u.peran]}
                              {u.prodi ? ` · ${u.prodi.kode}` : ""}
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
                  );
                })}
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
