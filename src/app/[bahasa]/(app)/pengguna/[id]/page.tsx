import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { FormulirNamaLokal, PengaturPeran, PengaturStatus, TombolSinkronPengguna } from "./formulir";
import { Badge } from "@/components/ui/badge";
import { tampilanDariRujukan } from "@/lib/pengguna/tampilan";
import { tampilanTakDiketahui } from "@/domain/identitas/tampilan";
import { env } from "@/lib/env";
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
      select: {
        id: true,
        email: true,
        nama: true,
        identitasAkunId: true,
        status: true,
        terakhirMasuk: true,
        penugasan: {
          select: {
            id: true,
            peran: true,
            sumber: true,
            prodi: { select: { nama: true, kode: true } },
          },
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

  // Nama, gelar, NIDN, NIP pegawai dibaca dari identitas-itts (docs/26 §4); tak ada salinannya di sini.
  const tampilan =
    (await tampilanDariRujukan([pengguna])).get(pengguna.id) ?? tampilanTakDiketahui(pengguna.email);
  const bertaut = pengguna.identitasAkunId !== null;
  const urlIdentitas = env.identitasItts?.url ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/pengguna">
          <ArrowLeft />
          {k.penggunaDetail.kembali}
        </ButtonLink>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tampilan.namaLengkap}</h1>
          <Badge variant={bertaut ? "outline" : "secondary"} className="text-[10px]">
            {bertaut ? k.pengguna.sumber.identitas : k.pengguna.sumber.lokal}
          </Badge>
        </div>
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
            bertaut={bertaut}
            penugasan={pengguna.penugasan.map((t) => ({
              id: t.id,
              peran: t.peran,
              prodiNama: t.prodi ? `${t.prodi.nama} (${t.prodi.kode})` : null,
              dariIdentitas: t.sumber === "IDENTITAS",
            }))}
          />
          {bertaut ? (
            <div className="mt-4">
              <TombolSinkronPengguna penggunaId={pengguna.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.penggunaDetail.profilJudul}</CardTitle>
          <CardDescription>
            {bertaut ? k.penggunaDetail.profilKeteranganIdentitas : k.penggunaDetail.profilKeteranganLokal}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bertaut ? (
            <div className="space-y-4">
              {tampilan.sumber === "TAK_DIKETAHUI" ? (
                <p className="text-sm text-warning">{k.penggunaDetail.tidakTerbaca}</p>
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">{k.penggunaDetail.namaLengkap}</dt>
                    <dd className="mt-0.5 font-medium">{tampilan.namaLengkap}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">NIDN</dt>
                    <dd className="mt-0.5 tabular-nums">{tampilan.nidn ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">NIP</dt>
                    <dd className="mt-0.5 tabular-nums">{tampilan.nip ?? "—"}</dd>
                  </div>
                </dl>
              )}
              {urlIdentitas ? (
                <ButtonLink variant="outline" size="sm" href={`${urlIdentitas}/pegawai`} target="_blank" rel="noreferrer">
                  {k.penggunaDetail.ubahDiIdentitas}
                </ButtonLink>
              ) : null}
            </div>
          ) : (
            <FormulirNamaLokal key={pengguna.nama} penggunaId={pengguna.id} awal={pengguna.nama} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
