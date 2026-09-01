import { Tautan } from "@/components/tautan";
import { GitPullRequestArrow, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { VARIAN_STATUS } from "./label";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import type { StatusUsulan } from "@/generated/prisma";
import { KotakCari } from "@/components/kotak-cari";
import { Paginasi } from "@/components/paginasi";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).usulan.metaJudul };
}

export default async function HalamanUsulan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const mentah = await searchParams;
  const kata = bacaKata(mentah.q);

  const saring = {
    kurikulum: filterProdi,
    ...(kata
      ? {
          OR: [
            { judul: { contains: kata, mode: "insensitive" as const } },
            { mataKuliah: { kode: { contains: kata, mode: "insensitive" as const } } },
            { mataKuliah: { nama: { contains: kata, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const isiBaris = {
    mataKuliah: { select: { kode: true, nama: true } },
    kurikulum: { select: { nama: true, tahun: true } },
    diajukanOleh: { select: { nama: true } },
    revisi: { select: { revisiKe: true } },
    _count: { select: { butir: true, catatan: true } },
  };

  /**
   * Yang menunggu keputusan ditarik TERPISAH dan tidak dihalamankan.
   *
   * Dahulu seluruh usulan dimuat sekaligus lalu diurutkan menurut status di
   * memori, sehingga yang diajukan selalu berada di atas. Begitu daftarnya
   * dihalamankan, urutan itu mustahil dipertahankan — urutan enum di Postgres
   * bukan urutan kepentingan. Memisahkannya justru lebih jujur: yang menunggu
   * keputusan adalah daftar kerja, sisanya riwayat.
   */
  const [menunggu, jumlahRiwayat] = await Promise.all([
    prisma.usulanRevisi.findMany({
      where: { ...saring, status: "DIAJUKAN" },
      orderBy: [{ diajukanPada: "asc" }],
      take: UKURAN_HALAMAN,
      include: isiBaris,
    }),
    prisma.usulanRevisi.count({ where: { ...saring, status: { not: "DIAJUKAN" } } }),
  ]);

  const halaman = hitungHalaman(jumlahRiwayat, bacaHalaman(mentah.hal), UKURAN_HALAMAN);

  const riwayat = await prisma.usulanRevisi.findMany({
    where: { ...saring, status: { not: "DIAJUKAN" } },
    orderBy: [{ diubahPada: "desc" }],
    skip: halaman.lewati,
    take: halaman.ambil,
    include: isiBaris,
  });

  const pemutus = punyaPeran(sesi, "ADMIN", "KAPRODI");
  const k = await kamus();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{k.usulan.judul}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{k.usulan.keterangan}</p>
        </div>
        <ButtonLink href="/usulan/baru">
          <Plus />
          {k.usulan.tombolBaru}
        </ButtonLink>
      </header>

      <KotakCari
        action="/usulan"
        nilai={kata}
        placeholder={k.usulan.cariPlaceholder}
      />

      {pemutus && menunggu.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
          <GitPullRequestArrow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">
              {isi(k.usulan.menungguAnda, { jumlah: menunggu.length })}
            </strong>{" "}
            {k.usulan.menungguAndaAkhir}
          </p>
        </div>
      ) : null}

      {menunggu.length === 0 && riwayat.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <Lock className="mx-auto size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {kata ? isi(k.usulan.tidakCocok, { kata }) : k.usulan.kosong}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {menunggu.length > 0 ? (
        <section className="space-y-3">
          <h2 className="label-teknis text-muted-foreground/80">
            {isi(k.usulan.menungguJudul, { jumlah: menunggu.length })}
          </h2>
          {menunggu.map((u) => (
            <KartuUsulan key={u.id} usulan={u} k={k} />
          ))}
        </section>
      ) : null}

      {riwayat.length > 0 ? (
        <section className="space-y-3">
          <h2 className="label-teknis text-muted-foreground/80">
            {k.usulan.riwayatJudul}
          </h2>
          {riwayat.map((u) => (
            <KartuUsulan key={u.id} usulan={u} k={k} />
          ))}
          <Paginasi
            halaman={halaman}
            basis="/usulan"
            params={{ q: kata }}
            satuan="usulan"
          />
        </section>
      ) : null}

    </div>
  );
}

type BarisUsulan = {
  id: string;
  judul: string;
  status: StatusUsulan;
  jalurRalat: boolean;
  mataKuliah: { kode: string; nama: string };
  kurikulum: { nama: string; tahun: number };
  diajukanOleh: { nama: string };
  revisi: { revisiKe: number } | null;
  _count: { butir: number; catatan: number };
};

function KartuUsulan({ usulan: u, k }: { usulan: BarisUsulan; k: Kamus }) {
  return (
    <Tautan href={`/usulan/${u.id}`} className="block">
      <Card className="transition-colors hover:border-ring/50">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={VARIAN_STATUS[u.status]}>{k.enum.statusUsulan[u.status]}</Badge>
            <Badge variant="outline">{u.mataKuliah.kode}</Badge>
            {u.jalurRalat ? (
              <Badge variant="secondary" className="text-[10px]">
                {k.usulan.ralat}
              </Badge>
            ) : null}
            {u.revisi ? (
              <Badge variant="secondary" className="text-[10px]">
                {isi(k.usulan.revisiKe, { nomor: u.revisi.revisiKe })}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="mt-2 text-base">{u.judul}</CardTitle>
          <CardDescription>
            {u.mataKuliah.nama} · {u.kurikulum.nama} ({u.kurikulum.tahun})
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {isi(k.usulan.ringkasanKartu, {
            butir: u._count.butir,
            catatan: u._count.catatan,
            oleh: u.diajukanOleh.nama,
          })}
        </CardContent>
      </Card>
    </Tautan>
  );
}
