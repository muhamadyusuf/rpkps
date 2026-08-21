import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { posisiMingguUjian } from "@/domain/beban-belajar/kalkulator";
import type { KonteksKisiKisi } from "@/domain/rpkps/kisi-kisi";
import type { LevelBloom } from "@/domain/kurikulum/bloom";
import { EditorKisiKisi } from "./editor";

export const dynamic = "force-dynamic";

export default async function HalamanKisiKisi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  const rpkps = await muatRpkps(id);
  if (!rpkps) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId)) notFound();

  const { kebijakan } = await muatKebijakan();
  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";

  const subCpmkTersedia = rpkps.mataKuliah.cpmk.flatMap((c) =>
    c.subCpmk.map((s) => ({ id: s.id, kode: s.kode, rumusan: s.rumusan })),
  );

  // Sub-CPMK dipisah berdasarkan posisi minggunya terhadap UTS: yang diajarkan
  // sebelum UTS diuji di UTS, sisanya di UAS.
  const mingguUts = posisiMingguUjian(kebijakan)[0] ?? kebijakan.mingguPerSemester;
  const sebelum: string[] = [];
  const sesudah: string[] = [];
  const bobotSubCpmk: Record<string, number> = {};

  for (const p of rpkps.pertemuan) {
    for (const s of p.subCpmk) {
      const kode = s.subCpmk.kode;
      (p.minggu < mingguUts ? sebelum : sesudah).push(kode);
      bobotSubCpmk[kode] = (bobotSubCpmk[kode] ?? 0) + Number(p.bobot);
    }
  }

  const levelSubCpmk: Record<string, LevelBloom | null> = {};
  for (const c of rpkps.mataKuliah.cpmk) {
    for (const s of c.subCpmk) {
      levelSubCpmk[s.kode] = (s.levelBloom as LevelBloom | null) ?? null;
    }
  }

  const konteks: KonteksKisiKisi = {
    subCpmkSebelumUts: [...new Set(sebelum)],
    subCpmkSetelahUts: [...new Set(sesudah)],
    levelSubCpmk,
    bobotSubCpmk,
  };

  const kisiKisi = await Promise.all(
    (["UTS", "UAS"] as const).map(async (jenis) => {
      const baris = rpkps.kisiKisi.find((k) => k.jenis === jenis);
      return {
        jenis,
        awal: {
          totalSkor: baris ? Number(baris.totalSkor) : 100,
          durasiMenit: baris?.durasiMenit ?? null,
          catatan: baris?.catatan ?? null,
          butir: (baris?.butir ?? []).map((b) => ({
            subCpmkId: b.subCpmkId,
            levelBloom: b.levelBloom,
            bentuk: b.bentuk,
            jumlahButir: b.jumlahButir,
            skor: Number(b.skor),
            indikator: b.indikator,
          })),
        },
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Kisi-kisi UTS &amp; UAS</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tiap butir terikat ke satu Sub-CPMK dan satu level Bloom, sehingga skor
          butir dapat langsung mengalir ke perhitungan ketercapaian CPMK.
        </p>
      </header>

      {!bisaSunting ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            RPKPS sudah diajukan atau terbit, sehingga tidak dapat disunting.
          </p>
        </div>
      ) : null}

      {kisiKisi.map(({ jenis, awal }) => (
        <Card key={jenis}>
          <CardHeader>
            <CardTitle className="text-base">Kisi-kisi {jenis}</CardTitle>
            <CardDescription>
              {jenis === "UTS"
                ? `Menguji ${konteks.subCpmkSebelumUts.length} Sub-CPMK yang dijadwalkan sebelum minggu ${mingguUts}.`
                : `Menguji ${konteks.subCpmkSetelahUts.length} Sub-CPMK yang dijadwalkan setelah UTS.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bisaSunting ? (
              <EditorKisiKisi
                rpkpsId={id}
                jenis={jenis}
                subCpmkTersedia={subCpmkTersedia}
                konteks={konteks}
                awal={awal}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {awal.butir.length} butir · total skor{" "}
                {awal.butir.reduce((s, b) => s + b.skor, 0)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
