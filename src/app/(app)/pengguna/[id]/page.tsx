import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { FormulirProfil, PengaturPeran, PengaturStatus } from "./formulir";

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
          Semua pengguna
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
            ? ` · terakhir masuk ${pengguna.terakhirMasuk.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`
            : " · belum pernah masuk"}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status akun</CardTitle>
          <CardDescription>
            Akun nonaktif langsung kehilangan sesi pada permintaan berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PengaturStatus penggunaId={pengguna.id} status={pengguna.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peran dan cakupan</CardTitle>
          <CardDescription>
            Administrator, Penjaminan Mutu, dan Asesor bercakupan institusi.
            Peran lain terikat pada satu program studi.
          </CardDescription>
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
          <CardTitle className="text-base">Profil kepegawaian</CardTitle>
          <CardDescription>
            NIDN dan gelar tercetak pada halaman pengesahan RPKPS, jadi isikan
            persis seperti yang seharusnya muncul di dokumen.
          </CardDescription>
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
