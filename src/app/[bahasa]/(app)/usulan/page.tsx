import { Tautan } from "@/components/tautan";
import { GitPullRequestArrow, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { VARIAN_STATUS } from "./label";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import type { Bahasa, Kamus } from "@/kamus";
import type { StatusUsulan } from "@/generated/prisma";
import { KotakCari } from "@/components/kotak-cari";
import { Paginasi } from "@/components/paginasi";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).usulan.metaJudul };
}

/**
 * Nama parameter halaman untuk antrean keputusan. Bukan `hal` — itu milik
 * riwayat di bawahnya, dan keduanya ada pada lembar yang sama.
 */
const KUNCI_HALAMAN_MENUNGGU = "halantre";

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
            { mataKuliah: { namaEn: { contains: kata, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const isiBaris = {
    mataKuliah: { select: { kode: true, nama: true, namaEn: true } },
    kurikulum: { select: { nama: true, tahun: true } },
    diajukanOleh: { select: { nama: true } },
    revisi: { select: { revisiKe: true } },
    _count: { select: { butir: true, catatan: true } },
  };

  /**
   * Yang menunggu keputusan ditarik TERPISAH dari riwayatnya.
   *
   * Dahulu seluruh usulan dimuat sekaligus lalu diurutkan menurut status di
   * memori, sehingga yang diajukan selalu berada di atas. Begitu daftarnya
   * dihalamankan, urutan itu mustahil dipertahankan — urutan enum di Postgres
   * bukan urutan kepentingan. Memisahkannya justru lebih jujur: yang menunggu
   * keputusan adalah daftar kerja, sisanya riwayat.
   *
   * Keduanya dihalamankan, masing-masing dengan parameternya sendiri. Antrean
   * keputusan dulu hanya dipotong `take` tanpa `skip` dan tanpa hitungan —
   * dan karena jumlahnya diambil dari `menunggu.length`, dua kalimat di layar
   * MELAPORKAN ANGKA YANG SALAH begitu antreannya melewati satu halaman:
   * "25 usulan menunggu Anda" pada antrean berisi tiga puluh.
   */
  const saringMenunggu = { ...saring, status: "DIAJUKAN" as const };
  const saringRiwayat = { ...saring, status: { not: "DIAJUKAN" as const } };

  const [jumlahMenunggu, jumlahRiwayat] = await Promise.all([
    prisma.usulanRevisi.count({ where: saringMenunggu }),
    prisma.usulanRevisi.count({ where: saringRiwayat }),
  ]);

  const halamanMenunggu = hitungHalaman(
    jumlahMenunggu,
    bacaHalaman(mentah[KUNCI_HALAMAN_MENUNGGU]),
    UKURAN_HALAMAN,
  );
  const halaman = hitungHalaman(jumlahRiwayat, bacaHalaman(mentah.hal), UKURAN_HALAMAN);

  const [menunggu, riwayat] = await Promise.all([
    prisma.usulanRevisi.findMany({
      where: saringMenunggu,
      orderBy: [{ diajukanPada: "asc" }],
      skip: halamanMenunggu.lewati,
      take: halamanMenunggu.ambil,
      include: isiBaris,
    }),
    prisma.usulanRevisi.findMany({
      where: saringRiwayat,
      orderBy: [{ diubahPada: "desc" }],
      skip: halaman.lewati,
      take: halaman.ambil,
      include: isiBaris,
    }),
  ]);

  /** Tautan antrean membawa halaman riwayat, dan sebaliknya. */
  const paramMenunggu = {
    q: kata,
    hal: halaman.halaman > 1 ? String(halaman.halaman) : undefined,
  };
  const paramRiwayat = {
    q: kata,
    [KUNCI_HALAMAN_MENUNGGU]:
      halamanMenunggu.halaman > 1 ? String(halamanMenunggu.halaman) : undefined,
  };

  const pemutus = punyaPeran(sesi, "ADMIN", "KAPRODI");
  const k = await kamus();
  const b = await bahasaAktif();

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
              {isi(k.usulan.menungguAnda, { jumlah: jumlahMenunggu })}
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
            {isi(k.usulan.menungguJudul, { jumlah: jumlahMenunggu })}
          </h2>
          {menunggu.map((u) => (
            <KartuUsulan key={u.id} usulan={u} k={k} b={b} />
          ))}
          <Paginasi
            halaman={halamanMenunggu}
            basis="/usulan"
            params={paramMenunggu}
            satuan="usulan"
            kunci={KUNCI_HALAMAN_MENUNGGU}
          />
        </section>
      ) : null}

      {riwayat.length > 0 ? (
        <section className="space-y-3">
          <h2 className="label-teknis text-muted-foreground/80">
            {k.usulan.riwayatJudul}
          </h2>
          {riwayat.map((u) => (
            <KartuUsulan key={u.id} usulan={u} k={k} b={b} />
          ))}
          <Paginasi
            halaman={halaman}
            basis="/usulan"
            params={paramRiwayat}
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
  mataKuliah: { kode: string; nama: string; namaEn: string | null };
  kurikulum: { nama: string; tahun: number };
  diajukanOleh: { nama: string };
  revisi: { revisiKe: number } | null;
  _count: { butir: number; catatan: number };
};

function KartuUsulan({
  usulan: u,
  k,
  b,
}: {
  usulan: BarisUsulan;
  k: Kamus;
  b: Bahasa;
}) {
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
            {namaMk(u.mataKuliah, b)} · {u.kurikulum.nama} ({u.kurikulum.tahun})
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
