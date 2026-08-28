import Link from "next/link";
import { GitPullRequestArrow, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { LABEL_STATUS, VARIAN_STATUS } from "./label";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usulan Revisi Kurikulum" };

const URUTAN_STATUS = ["DIAJUKAN", "DIREVISI", "DRAF", "DITERAPKAN", "DITOLAK", "DITARIK"];

export default async function HalamanUsulan() {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const filterProdi = cakupan === null ? {} : { prodiId: { in: cakupan } };

  const daftar = await prisma.usulanRevisi.findMany({
    where: { kurikulum: filterProdi },
    orderBy: [{ diubahPada: "desc" }],
    include: {
      mataKuliah: { select: { kode: true, nama: true } },
      kurikulum: { select: { nama: true, tahun: true } },
      diajukanOleh: { select: { nama: true } },
      revisi: { select: { revisiKe: true } },
      _count: { select: { butir: true, catatan: true } },
    },
  });

  const menunggu = daftar.filter((u) => u.status === "DIAJUKAN");
  const pemutus = punyaPeran(sesi, "ADMIN", "KAPRODI");

  const berurut = [...daftar].sort(
    (a, z) => URUTAN_STATUS.indexOf(a.status) - URUTAN_STATUS.indexOf(z.status),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usulan Revisi Kurikulum</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Satu-satunya pintu mengubah CPMK dan Sub-CPMK. Dosen mengusulkan,
            Ketua Program Studi memutuskan dan mengesahkan.
          </p>
        </div>
        <ButtonLink href="/usulan/baru">
          <Plus />
          Usulan baru
        </ButtonLink>
      </header>

      {pemutus && menunggu.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
          <GitPullRequestArrow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">{menunggu.length} usulan</strong> menunggu
            keputusan Anda.
          </p>
        </div>
      ) : null}

      {berurut.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <Lock className="mx-auto size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Belum ada usulan revisi. Buka mata kuliah di menu Kurikulum, lalu
              tekan &ldquo;Usulkan revisi&rdquo; pada capaian yang perlu diperbaiki.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {berurut.map((u) => (
            <Link key={u.id} href={`/usulan/${u.id}`} className="block">
              <Card className="transition-colors hover:border-ring/50">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={VARIAN_STATUS[u.status]}>{LABEL_STATUS[u.status]}</Badge>
                    <Badge variant="outline">{u.mataKuliah.kode}</Badge>
                    {u.jalurRalat ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Ralat
                      </Badge>
                    ) : null}
                    {u.revisi ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Revisi {u.revisi.revisiKe}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="mt-2 text-base">{u.judul}</CardTitle>
                  <CardDescription>
                    {u.mataKuliah.nama} · {u.kurikulum.nama} ({u.kurikulum.tahun})
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {u._count.butir} butir · {u._count.catatan} catatan · diajukan{" "}
                  {u.diajukanOleh.nama}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
