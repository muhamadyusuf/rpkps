import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk, pilihTeks } from "@/lib/bahasa/teks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
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

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  const { kebijakan } = await muatKebijakan();
  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";

  const b = await bahasaAktif();
  const subCpmkTersedia = rpkps.mataKuliah.cpmk.flatMap((c) =>
    // Rumusan dipilih di sini, bukan di penyunting: yang menyeberang ke klien
    // cukup teks yang akan tampil (docs/11 §5.4).
    c.subCpmk.map((s) => ({
      id: s.id,
      kode: s.kode,
      rumusan: pilihTeks(s.rumusan, s.rumusanEn, b).teks,
    })),
  );

  /**
   * Sub-CPMK dipisah berdasarkan posisi minggunya terhadap UTS: yang diajarkan
   * sebelum UTS diuji di UTS, sisanya di UAS.
   *
   * Batasnya diambil dari BARIS UTS yang benar-benar ada di tabel, bukan dari
   * posisi menurut kebijakan. Sejak tabel mingguan dapat disusun manual
   * (docs/09), keduanya bisa berbeda — dan memakai angka kebijakan berarti
   * memisahkan di minggu 8 padahal UTS-nya di minggu 9, tanpa tanda apa pun.
   * Kebijakan hanya menjadi cadangan bila baris ujiannya memang belum ada.
   */
  const mingguUts =
    rpkps.pertemuan.find((p) => p.jenis === "UTS")?.minggu ??
    posisiMingguUjian(kebijakan)[0] ??
    kebijakan.mingguPerSemester;
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
          catatanEn: baris?.catatanEn ?? null,
          butir: (baris?.butir ?? []).map((b) => ({
            subCpmkId: b.subCpmkId,
            levelBloom: b.levelBloom,
            bentuk: b.bentuk,
            jumlahButir: b.jumlahButir,
            skor: Number(b.skor),
            indikator: b.indikator,
            indikatorEn: b.indikatorEn,
          })),
        },
      };
    }),
  );

  const k = await kamus();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {namaMk(rpkps.mataKuliah, b)}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.rpkps.kisiKisi.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.rpkps.kisiKisi.keterangan}
        </p>
      </header>

      {!bisaSunting ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            {k.rpkps.terkunciSunting}
          </p>
        </div>
      ) : null}

      {kisiKisi.map(({ jenis, awal }) => (
        <Card key={jenis}>
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.rpkps.kisiKisi.kartuJudul, { jenis })}
            </CardTitle>
            <CardDescription>
              {jenis === "UTS"
                ? isi(k.rpkps.kisiKisi.keteranganUts, {
                    jumlah: konteks.subCpmkSebelumUts.length,
                    minggu: mingguUts,
                  })
                : isi(k.rpkps.kisiKisi.keteranganUas, {
                    jumlah: konteks.subCpmkSetelahUts.length,
                  })}
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
                {isi(k.rpkps.kisiKisi.ringkasBacaSaja, {
                  butir: awal.butir.length,
                  skor: awal.butir.reduce((s, b) => s + b.skor, 0),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
