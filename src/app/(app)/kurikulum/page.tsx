import Link from "next/link";
import { BookUp, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { TombolStatusKurikulum } from "./tombol";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kurikulum" };

const WARNA_STATUS = {
  BERLAKU: "default",
  DRAF: "outline",
  ARSIP: "secondary",
} as const;

export default async function HalamanKurikulum() {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const bolehImpor = punyaPeran(sesi, "ADMIN", "KAPRODI");

  const daftar = await prisma.kurikulum.findMany({
    where: cakupan === null ? {} : { prodiId: { in: cakupan } },
    orderBy: [{ tahun: "desc" }, { nama: "asc" }],
    include: {
      prodi: { select: { nama: true, kode: true } },
      _count: { select: { cpl: true, mataKuliah: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-teknis mb-2 text-muted-foreground/70">Modul</p>
          <h1 className="text-2xl font-semibold tracking-tight">Kurikulum</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sumber kebenaran untuk CPL, CPMK, dan Sub-CPMK.
          </p>
        </div>
        {bolehImpor ? (
          <ButtonLink href="/kurikulum/impor">
            <Plus />
            Impor kurikulum
          </ButtonLink>
        ) : null}
      </header>

      {daftar.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <BookUp className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Belum ada kurikulum</CardTitle>
                <CardDescription className="mt-1">
                  Impor buku kurikulum program studi lewat template Excel. Tanpa
                  ini, penyusun RPKPS tidak punya CPL dan CPMK untuk dirujuk.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {bolehImpor ? (
            <CardContent>
              <ButtonLink variant="outline" href="/kurikulum/impor">
                Mulai impor
              </ButtonLink>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-3">
          {daftar.map((k) => (
            <Card key={k.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/kurikulum/${k.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {k.nama}
                      </Link>
                      <Badge variant={WARNA_STATUS[k.status]}>
                        {k.status === "BERLAKU"
                          ? "Berlaku"
                          : k.status === "DRAF"
                            ? "Draf"
                            : "Arsip"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {k.prodi.nama} ({k.prodi.kode}) · {k.tahun} ·{" "}
                      {k._count.cpl} CPL · {k._count.mataKuliah} mata kuliah
                    </p>
                  </div>
                  {bolehImpor ? (
                    <TombolStatusKurikulum id={k.id} status={k.status} />
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
