import Link from "next/link";
import { ArrowRight, CircleAlert, Timer, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { wajibAktif, punyaPeran, LABEL_PERAN } from "@/lib/otorisasi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dasbor" };

export default async function HalamanDasbor() {
  const sesi = await wajibAktif();
  const bolehKelola = punyaPeran(sesi, "ADMIN", "GPM");

  const [jumlahProdi, jumlahPengguna, menungguVerifikasi, tahunAktif, kebijakan] =
    await Promise.all([
      prisma.prodi.count({ where: { aktif: true } }),
      prisma.pengguna.count(),
      prisma.pengguna.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
      prisma.tahunAkademik.findFirst({ where: { aktif: true } }),
      prisma.kebijakanBebanBelajar.findFirst({
        orderBy: { dibuatPada: "desc" },
        select: { id: true, nama: true, status: true },
      }),
    ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="label-teknis mb-2 text-muted-foreground/70">Dasbor</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Selamat datang, {sesi.nama.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tahunAktif
            ? `Tahun akademik aktif: ${tahunAktif.kode.replace("-", " ")}`
            : "Belum ada tahun akademik yang ditandai aktif."}
          {sesi.daftarPeran.length > 0
            ? ` · Peran Anda: ${sesi.daftarPeran.map((p) => LABEL_PERAN[p]).join(", ")}`
            : null}
        </p>
      </header>

      {kebijakan?.status === "DRAF" && bolehKelola ? (
        <Card className="mb-6 border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">
                  Kebijakan beban belajar belum diberlakukan
                </CardTitle>
                <CardDescription className="mt-1">
                  Angkanya masih bawaan SN-Dikti. Konfirmasi enam pertanyaan ke
                  Penjaminan Mutu sebelum RPKPS pertama disimpan — memperbaikinya
                  setelah ada dokumen terbit berarti menghitung ulang semuanya.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ButtonLink variant="outline" href="/kebijakan">
              Tinjau kebijakan
              <ArrowRight />
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KartuAngka
          judul="Program studi"
          angka={jumlahProdi}
          keterangan="prodi aktif"
          href={punyaPeran(sesi, "ADMIN") ? "/master/prodi" : undefined}
        />
        <KartuAngka
          judul="Pengguna terdaftar"
          angka={jumlahPengguna}
          keterangan={
            menungguVerifikasi > 0
              ? `${menungguVerifikasi} menunggu verifikasi`
              : "semua terverifikasi"
          }
          sorot={menungguVerifikasi > 0}
          ikon={<Users className="size-4" />}
          href={punyaPeran(sesi, "ADMIN") ? "/pengguna" : undefined}
        />
        <KartuAngka
          judul="Kebijakan beban belajar"
          angka={kebijakan ? 1 : 0}
          keterangan={
            kebijakan
              ? kebijakan.status === "BERLAKU"
                ? "berlaku"
                : "masih draf"
              : "belum ada — jalankan npm run db:seed"
          }
          ikon={<Timer className="size-4" />}
          href={bolehKelola ? "/kebijakan" : undefined}
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Tahap berikutnya</CardTitle>
          <CardDescription>
            Fondasi (F0) sudah terpasang. Modul kurikulum dan penyusun RPKPS
            menyusul setelah kebijakan beban belajar dikunci.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground marker:font-mono marker:text-cahaya/70">
            <li>Konfirmasi kebijakan beban belajar ke Penjaminan Mutu, lalu ubah statusnya menjadi Berlaku.</li>
            <li>Lengkapi program studi dan tahun akademik.</li>
            <li>Verifikasi pengguna: isikan NIDN/NIP, peran, dan prodi.</li>
            <li>Impor buku kurikulum: CPL, mata kuliah, CPMK, dan Sub-CPMK.</li>
            <li>F2 — penyusun RPKPS di atas kurikulum yang sudah terkunci.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function KartuAngka({
  judul,
  angka,
  keterangan,
  href,
  sorot,
  ikon,
}: {
  judul: string;
  angka: number;
  keterangan: string;
  href?: string;
  sorot?: boolean;
  ikon?: React.ReactNode;
}) {
  const isi = (
    <Card
      className={
        href
          ? "transition-colors hover:border-cahaya/40 hover:bg-cahaya/4"
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="label-teknis flex items-center gap-1.5 text-muted-foreground/80">
            {ikon}
            {judul}
          </CardDescription>
          {sorot ? <Badge variant="outline">perlu tindakan</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl leading-none font-semibold tabular-nums">
          {angka}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{keterangan}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {isi}
    </Link>
  ) : (
    isi
  );
}
