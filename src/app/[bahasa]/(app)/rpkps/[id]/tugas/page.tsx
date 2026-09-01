import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps } from "@/lib/rpkps/muat";
import { TombolBuatTugas, TombolHapusTugas } from "./tombol";

export const dynamic = "force-dynamic";

export default async function HalamanTugas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  const rpkps = await muatRpkps(id);
  if (!rpkps) notFound();

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";

  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {namaMk(rpkps.mataKuliah, b)}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {k.rpkps.tugas.judul}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {k.rpkps.tugas.keterangan}
          </p>
        </div>
        {bisaSunting ? <TombolBuatTugas rpkpsId={id} /> : null}
      </header>

      {rpkps.tugas.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{k.rpkps.tugas.kosongJudul}</CardTitle>
                <CardDescription className="mt-1">
                  {k.rpkps.tugas.kosongIsi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {rpkps.tugas.map((t) => {
            const totalKriteria = t.kriteria.reduce((s, k) => s + Number(k.bobot), 0);
            const pas = Math.abs(totalKriteria - 100) < 0.01;
            return (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {isi(k.rpkps.tugas.nomor, { nomor: t.nomor })}
                        </Badge>
                        <Tautan
                          href={`/rpkps/${id}/tugas/${t.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {t.nama}
                        </Tautan>
                        <Badge variant="outline" className="text-[10px]">
                          {t.jenis === "KELOMPOK"
                            ? k.rpkps.tugas.kelompok
                            : k.rpkps.tugas.individu}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isi(k.rpkps.tugas.ringkas, {
                          mulai: t.mingguMulai,
                          selesai: t.mingguSelesai,
                          bobot: Number(t.bobot),
                          sub: t.subCpmk.length,
                          tahap: t.linimasa.length,
                        })}
                      </p>
                      <p
                        className={`mt-1 text-xs ${pas ? "text-muted-foreground" : "font-medium text-destructive"}`}
                      >
                        {isi(k.rpkps.tugas.bobotIndikator, {
                          total: Math.round(totalKriteria * 100) / 100,
                        })}
                        {pas ? "" : k.rpkps.tugas.harus100}
                      </p>
                    </div>
                    {bisaSunting ? (
                      <TombolHapusTugas tugasId={t.id} nama={t.nama} />
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
