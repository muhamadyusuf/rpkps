import { BookOpen } from "lucide-react";
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
import { Paginasi } from "@/components/paginasi";
import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { prisma } from "@/lib/prisma";
import { saringDaftarBuku } from "@/lib/bahan-ajar/wenang";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";
import { TombolBuatBuku } from "./tombol";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).bahanAjar.metaJudul };
}

/**
 * Nama parameter halaman untuk daftar "belum punya buku ajar". Bukan `hal` —
 * itu milik daftar buku ajar di atasnya, dan keduanya ada pada lembar yang sama.
 */
const KUNCI_HALAMAN_BELUM = "halbelum";

/**
 * Daftar buku ajar — docs/16 §5.1.
 *
 * Dihalamankan dan disaring DI BASIS DATA. Daftar ini bercakupan institusi bagi
 * ADMIN dan GPM, jadi memuat seluruh baris lalu menyaringnya di JavaScript akan
 * tumbuh seiring umur aplikasi dan tidak pernah menyusut.
 */
export default async function HalamanBahanAjar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);

  const mentah = await searchParams;
  const kata = bacaKata(mentah.q);

  const pencarian = kata
    ? {
        OR: [
          { judul: { contains: kata, mode: "insensitive" as const } },
          {
            rpkps: {
              mataKuliah: {
                OR: [
                  { kode: { contains: kata, mode: "insensitive" as const } },
                  { nama: { contains: kata, mode: "insensitive" as const } },
                  { namaEn: { contains: kata, mode: "insensitive" as const } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const saring = { AND: [saringDaftarBuku(sesi, cakupan), pencarian] };

  /*
   * RPKPS yang pengguna AMPU dan belum punya buku ajar sama sekali. Bukan
   * seluruh RPKPS dalam cakupannya: yang boleh menulis buku hanyalah
   * pengampunya, jadi menawarkan tombol kepada pengelola akan menawarkan
   * pekerjaan yang aksinya sendiri akan menolak (docs/16 P3).
   *
   * Satu bentuk saringan untuk menghitung DAN untuk mengambil — sebelumnya ia
   * hanya diambil, dengan `take` tanpa `skip`, sehingga daftarnya terpotong
   * diam-diam di baris ke-25 dan sisanya tidak dapat dicapai dari mana pun.
   */
  const saringBelum = {
    pengampu: { some: { penggunaId: sesi.id } },
    status: { not: "ARSIP" as const },
    bukuAjar: { none: {} },
    pertemuan: { some: { jenis: "EFEKTIF" as const, topik: { not: null } } },
  };

  // Keduanya saling bebas dan basis datanya jauh: satu gelombang, bukan dua
  // perjalanan berurutan.
  const [jumlah, jumlahBelum] = await Promise.all([
    prisma.bukuAjar.count({ where: saring }),
    prisma.rpkps.count({ where: saringBelum }),
  ]);

  const halaman = hitungHalaman(jumlah, bacaHalaman(mentah.hal), UKURAN_HALAMAN);
  /*
    Daftar kedua pada lembar yang sama, jadi nomor halamannya memakai
    parameter sendiri, dan keduanya saling diteruskan lewat `params`.
  */
  const halamanBelum = hitungHalaman(
    jumlahBelum,
    bacaHalaman(mentah[KUNCI_HALAMAN_BELUM]),
    UKURAN_HALAMAN,
  );

  const [buku, belum] = await Promise.all([
    prisma.bukuAjar.findMany({
      where: saring,
      orderBy: { diubahPada: "desc" },
      skip: halaman.lewati,
      take: halaman.ambil,
      select: {
        id: true,
        judul: true,
        bahasa: true,
        diubahPada: true,
        rpkps: {
          select: {
            mataKuliah: { select: { kode: true, nama: true, namaEn: true } },
            tahunAkademik: { select: { kode: true } },
          },
        },
        bab: { select: { uraian: true } },
      },
    }),
    prisma.rpkps.findMany({
      where: saringBelum,
      orderBy: { diubahPada: "desc" },
      skip: halamanBelum.lewati,
      take: halamanBelum.ambil,
      select: {
        id: true,
        mataKuliah: { select: { kode: true, nama: true, namaEn: true } },
        tahunAkademik: { select: { kode: true } },
        _count: { select: { pertemuan: true } },
      },
    }),
  ]);

  const k = await kamus();
  const b = await bahasaAktif();

  /** Tautan daftar buku membawa halaman daftar "belum", dan sebaliknya. */
  const paramBuku = {
    q: kata,
    [KUNCI_HALAMAN_BELUM]:
      halamanBelum.halaman > 1 ? String(halamanBelum.halaman) : undefined,
  };
  const paramBelum = {
    q: kata,
    hal: halaman.halaman > 1 ? String(halaman.halaman) : undefined,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">{k.bahanAjar.eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{k.bahanAjar.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{k.bahanAjar.keterangan}</p>
      </header>

      {buku.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  {kata ? isi(k.bahanAjar.tidakCocokJudul, { kata }) : k.bahanAjar.kosongJudul}
                </CardTitle>
                <CardDescription className="mt-1">
                  {kata ? k.bahanAjar.tidakCocokIsi : k.bahanAjar.kosongIsi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.bahanAjar.daftarJudul, { jumlah })}
            </CardTitle>
            <CardDescription>{k.bahanAjar.daftarKeterangan}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{k.bahanAjar.kolomBuku}</TableHead>
                    <TableHead>{k.bahanAjar.kolomMk}</TableHead>
                    <TableHead className="text-center">{k.bahanAjar.kolomBab}</TableHead>
                    <TableHead className="text-right">{k.bahanAjar.kolomBahasa}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buku.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell>
                        <Tautan
                          href={`/bahan-ajar/${x.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {x.judul}
                        </Tautan>
                      </TableCell>
                      <TableCell className="text-sm">
                        {x.rpkps.mataKuliah.kode} — {namaMk(x.rpkps.mataKuliah, b)}
                        <p className="text-xs text-muted-foreground">
                          {x.rpkps.tahunAkademik.kode.replace("-", " ")}
                        </p>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {isi(k.bahanAjar.babRingkas, {
                          berisi: x.bab.filter((s) => s.uraian?.trim()).length,
                          total: x.bab.length,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {x.bahasa === "en" ? k.bahanAjar.bahasaEn : k.bahanAjar.bahasaId}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Paginasi
              className="mt-4"
              halaman={halaman}
              basis="/bahan-ajar"
              params={paramBuku}
              satuan="bukuAjar"
            />
          </CardContent>
        </Card>
      )}

      {belum.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.bahanAjar.belumJudul, { jumlah: jumlahBelum })}
            </CardTitle>
            <CardDescription>{k.bahanAjar.belumKeterangan}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {belum.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.mataKuliah.kode} — {namaMk(r.mataKuliah, b)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.tahunAkademik.kode.replace("-", " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TombolBuatBuku rpkpsId={r.id} bahasa="id" />
                    <TombolBuatBuku rpkpsId={r.id} bahasa="en" />
                  </div>
                </div>
              ))}
            </div>

            <Paginasi
              className="mt-4"
              halaman={halamanBelum}
              basis="/bahan-ajar"
              params={paramBelum}
              satuan="rpkps"
              kunci={KUNCI_HALAMAN_BELUM}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
