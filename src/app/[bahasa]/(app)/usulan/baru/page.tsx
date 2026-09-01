import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { FormulirUsulanBaru } from "./formulir";
import { kamus } from "@/lib/bahasa/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).usulan.baru.metaJudul };
}

export default async function HalamanUsulanBaru({
  searchParams,
}: {
  searchParams: Promise<{ mk?: string }>;
}) {
  const sesi = await wajibAktif();
  const { mk } = await searchParams;
  const cakupan = cakupanProdi(sesi);
  const k = await kamus();

  // Hanya kurikulum BERLAKU: mengusulkan revisi atas kurikulum draf tidak ada
  // gunanya — draf masih boleh disunting langsung oleh Kaprodi.
  const daftarMk = await prisma.mataKuliah.findMany({
    where: {
      kurikulum: {
        status: "BERLAKU",
        ...(cakupan === null ? {} : { prodiId: { in: cakupan } }),
      },
    },
    orderBy: [{ kurikulum: { tahun: "desc" } }, { semester: "asc" }, { kode: "asc" }],
    select: {
      id: true,
      kode: true,
      nama: true,
      namaEn: true,
      semester: true,
      kurikulum: { select: { nama: true, tahun: true } },
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/usulan">
          <ArrowLeft />
          {k.usulan.baru.kembali}
        </ButtonLink>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{k.usulan.baru.judul}</CardTitle>
          <CardDescription>{k.usulan.baru.keterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          {daftarMk.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.usulan.baru.tanpaMk}</p>
          ) : (
            <FormulirUsulanBaru daftarMk={daftarMk} mkTerpilih={mk} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
