import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { FormulirUsulanBaru } from "./formulir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usulan revisi baru" };

export default async function HalamanUsulanBaru({
  searchParams,
}: {
  searchParams: Promise<{ mk?: string }>;
}) {
  const sesi = await wajibAktif();
  const { mk } = await searchParams;
  const cakupan = cakupanProdi(sesi);

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
      semester: true,
      kurikulum: { select: { nama: true, tahun: true } },
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/usulan">
          <ArrowLeft />
          Usulan Revisi
        </ButtonLink>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usulan revisi baru</CardTitle>
          <CardDescription>
            Satu usulan menyasar satu mata kuliah. Butir perubahannya ditambahkan
            setelah usulan ini dibuat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daftarMk.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada mata kuliah pada kurikulum berstatus berlaku di prodi Anda.
            </p>
          ) : (
            <FormulirUsulanBaru daftarMk={daftarMk} mkTerpilih={mk} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
