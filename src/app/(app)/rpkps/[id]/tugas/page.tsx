import Link from "next/link";
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Detail Tugas / Proyek</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Bagian I dokumen RPKPS. Bobot indikator tiap tugas harus berjumlah 100%.
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
                <CardTitle className="text-base">Belum ada tugas</CardTitle>
                <CardDescription className="mt-1">
                  Bagian I bersifat opsional — RPKPS tetap dapat diajukan tanpanya.
                  Tetapi mata kuliah berproyek sebaiknya mencantumkannya agar
                  mahasiswa tahu tagihan dan linimasanya sejak awal.
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
                        <Badge variant="secondary">Tugas {t.nomor}</Badge>
                        <Link
                          href={`/rpkps/${id}/tugas/${t.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {t.nama}
                        </Link>
                        <Badge variant="outline" className="text-[10px]">
                          {t.jenis === "KELOMPOK" ? "Kelompok" : "Individu"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Minggu {t.mingguMulai}–{t.mingguSelesai} · bobot {Number(t.bobot)}% ·{" "}
                        {t.subCpmk.length} Sub-CPMK · {t.linimasa.length} tahapan
                      </p>
                      <p
                        className={`mt-1 text-xs ${pas ? "text-muted-foreground" : "font-medium text-destructive"}`}
                      >
                        Bobot indikator: {Math.round(totalKriteria * 100) / 100}%
                        {pas ? "" : " — harus 100%"}
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
