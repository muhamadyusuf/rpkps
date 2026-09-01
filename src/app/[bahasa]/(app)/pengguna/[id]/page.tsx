import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { FormulirProfil, PengaturPeran, PengaturStatus } from "./formulir";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi } from "@/lib/bahasa/teks";

export const dynamic = "force-dynamic";

export default async function HalamanDetailPengguna({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await wajibPeran("ADMIN");
  const { id } = await params;

  const [pengguna, prodi] = await Promise.all([
    prisma.pengguna.findUnique({
      where: { id },
      include: {
        penugasan: {
          include: { prodi: { select: { nama: true, kode: true } } },
          orderBy: { dibuatPada: "asc" },
        },
      },
    }),
    prisma.prodi.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, kode: true },
    }),
  ]);

  if (!pengguna) notFound();

  const k = await kamus();
  const b = await bahasaAktif();

  /**
   * Nilai awal FormulirProfil, dipisah karena dipakai dua kali: sebagai prop,
   * dan sebagai `key`.
   *
   * Formulirnya tak terkendali — isian tersimpan di DOM lewat defaultValue —
   * sehingga nilai awal hanya terbaca saat dipasang. Setelah simpan, aksi
   * memanggil router.refresh() dan server mengirim nilai yang sudah
   * dinormalkan; tanpa `key` formulir bertahan dengan isi lama dan Base UI
   * memperingatkan defaultValue yang berubah setelah inisialisasi.
   */
  const profilAwal = {
    nama: pengguna.nama,
    gelarDepan: pengguna.gelarDepan ?? "",
    gelarBelakang: pengguna.gelarBelakang ?? "",
    nidn: pengguna.nidn ?? "",
    nip: pengguna.nip ?? "",
    nik: pengguna.nik ?? "",
    telepon: pengguna.telepon ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/pengguna">
          <ArrowLeft />
          {k.penggunaDetail.kembali}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {[pengguna.gelarDepan, pengguna.nama, pengguna.gelarBelakang]
            .filter(Boolean)
            .join(" ")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {pengguna.email}
          {pengguna.terakhirMasuk
            ? isi(k.penggunaDetail.terakhirMasuk, {
                tanggal: tanggal(pengguna.terakhirMasuk, b, "panjang"),
              })
            : k.penggunaDetail.belumPernahMasuk}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.penggunaDetail.statusJudul}</CardTitle>
          <CardDescription>{k.penggunaDetail.statusKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <PengaturStatus penggunaId={pengguna.id} status={pengguna.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.penggunaDetail.peranJudul}</CardTitle>
          <CardDescription>{k.penggunaDetail.peranKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <PengaturPeran
            penggunaId={pengguna.id}
            prodi={prodi}
            penugasan={pengguna.penugasan.map((t) => ({
              id: t.id,
              peran: t.peran,
              prodiNama: t.prodi ? `${t.prodi.nama} (${t.prodi.kode})` : null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.penggunaDetail.profilJudul}</CardTitle>
          <CardDescription>{k.penggunaDetail.profilKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormulirProfil
            key={JSON.stringify(profilAwal)}
            penggunaId={pengguna.id}
            awal={profilAwal}
          />
        </CardContent>
      </Card>
    </div>
  );
}
