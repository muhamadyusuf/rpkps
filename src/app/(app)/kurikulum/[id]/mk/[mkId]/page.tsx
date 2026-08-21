import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { infoLevel, type LevelBloom } from "@/domain/kurikulum/bloom";
import { formatMenit, paguPertemuanEfektif } from "@/domain/beban-belajar/kalkulator";
import type { Kebijakan } from "@/domain/beban-belajar/tipe";

export const dynamic = "force-dynamic";

function labelLevel(level: string | null): string | null {
  if (!level) return null;
  try {
    const info = infoLevel(level as LevelBloom);
    return `${info.level} · ${info.nama}`;
  } catch {
    return level;
  }
}

export default async function HalamanMataKuliah({
  params,
}: {
  params: Promise<{ id: string; mkId: string }>;
}) {
  const sesi = await wajibAktif();
  const { id, mkId } = await params;

  const [mk, kebijakanBaris] = await Promise.all([
    prisma.mataKuliah.findUnique({
      where: { id: mkId },
      include: {
        kurikulum: {
          select: { id: true, nama: true, tahun: true, prodiId: true, prodi: { select: { kode: true } } },
        },
        cpl: { include: { cpl: { select: { kode: true, deskripsi: true } } } },
        cpmk: {
          orderBy: { urutan: "asc" },
          include: {
            cpl: { include: { cpl: { select: { kode: true } } } },
            subCpmk: { orderBy: { urutan: "asc" } },
          },
        },
      },
    }),
    prisma.kebijakanBebanBelajar.findFirst({
      orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
      include: { bentuk: true },
    }),
  ]);

  if (!mk || mk.kurikulum.id !== id) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(mk.kurikulum.prodiId)) notFound();

  // Pagu waktu dihitung langsung dari kebijakan yang ada, supaya konsekuensi
  // pemecahan sks teori/praktik terlihat sejak level kurikulum.
  let pagu: ReturnType<typeof paguPertemuanEfektif> | null = null;
  if (kebijakanBaris) {
    const kebijakan: Kebijakan = {
      mingguPerSemester: kebijakanBaris.mingguPerSemester,
      pertemuanEfektifTeori: kebijakanBaris.pertemuanEfektifTeori,
      pertemuanEfektifPraktik: kebijakanBaris.pertemuanEfektifPraktik,
      hitungMingguUjian: kebijakanBaris.hitungMingguUjian,
      menitTmPerUjian: kebijakanBaris.menitTmPerUjian,
      jamPerSksPerSemester: Number(kebijakanBaris.jamPerSksPerSemester),
      toleransiSemesterPersen: Number(kebijakanBaris.toleransiSemesterPersen),
      toleransiPertemuanPersen: Number(kebijakanBaris.toleransiPertemuanPersen),
      bentuk: kebijakanBaris.bentuk.map((b) => ({
        bentuk: b.bentuk,
        tm: b.menitTmPerSks,
        pt: b.menitPtPerSks,
        bm: b.menitBmPerSks,
        tmTerjadwal: b.tmTerjadwal,
        butuhRuangKhusus: b.butuhRuangKhusus,
      })),
    };
    try {
      pagu = paguPertemuanEfektif(kebijakan, {
        sksTeori: mk.sksTeori,
        sksPraktik: mk.sksPraktik,
        bentukTeori: mk.bentukTeori,
        bentukPraktik: mk.bentukPraktik,
      });
    } catch {
      pagu = null;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/kurikulum/${id}`}>
          <ArrowLeft />
          {mk.kurikulum.nama}
        </ButtonLink>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{mk.kode}</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">{mk.nama}</h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Semester {mk.semester} · {mk.sksTeori + mk.sksPraktik} sks (
          {mk.sksTeori} teori + {mk.sksPraktik} praktik) · {mk.kurikulum.prodi.kode}
        </p>
      </header>

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          CPL, CPMK, dan Sub-CPMK di halaman ini bersifat <strong>read-only</strong>{" "}
          bagi penyusun RPKPS. Perubahan rumusan harus melalui usulan revisi
          kurikulum kepada Ketua Program Studi.
        </p>
      </div>

      {pagu ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagu waktu per minggu</CardTitle>
            <CardDescription>
              Dihitung dari kebijakan beban belajar yang berlaku.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <Metrik label="Total" nilai={formatMenit(pagu.total)} />
              <Metrik label="Tatap muka" nilai={formatMenit(pagu.tm)} />
              <Metrik label="Terjadwal" nilai={formatMenit(pagu.terjadwal)} />
              <Metrik
                label="Ruang khusus"
                nilai={pagu.ruangKhusus > 0 ? formatMenit(pagu.ruangKhusus) : "—"}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CPL yang dibebankan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mk.cpl.map((m) => (
            <div key={m.cplId} className="border-b pb-3 last:border-0 last:pb-0">
              <Badge variant="outline">{m.cpl.kode}</Badge>
              <p className="mt-1 text-sm">{m.cpl.deskripsi}</p>
            </div>
          ))}
          {mk.cpl.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada CPL yang dibebankan.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          CPMK dan Sub-CPMK ({mk.cpmk.length})
        </h2>

        {mk.cpmk.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{c.kode}</Badge>
                {c.levelBloom ? (
                  <Badge variant="outline" className="text-[10px]">
                    {labelLevel(c.levelBloom)}
                  </Badge>
                ) : null}
                {c.cpl.map((x) => (
                  <Badge key={x.cplId} variant="secondary" className="text-[10px]">
                    {x.cpl.kode}
                  </Badge>
                ))}
                {c.sumber === "AI" ? <LencanaAi /> : null}
              </div>
              <CardDescription className="mt-2 text-foreground">
                {c.rumusan}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {c.subCpmk.length === 0 ? (
                <p className="text-sm text-destructive">
                  Belum ada Sub-CPMK — RPKPS tidak dapat disusun tanpa tahapan belajar.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {c.subCpmk.map((s) => (
                    <li key={s.id} className="flex gap-3 text-sm">
                      <div className="flex shrink-0 flex-col items-start gap-1">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {s.kode}
                        </Badge>
                        {s.levelBloom ? (
                          <span className="text-[10px] text-muted-foreground">
                            {s.levelBloom}
                          </span>
                        ) : null}
                        {s.sumber === "AI" ? <LencanaAi /> : null}
                      </div>
                      <p className="min-w-0 flex-1 pt-0.5">{s.rumusan}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}

        {mk.cpmk.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Belum ada CPMK untuk mata kuliah ini.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Jejak asal isi (docs/01 §4.8). Rumusan hasil usulan AI yang diterima saat
 * impor ditandai terbuka — asesor berhak tahu bagian mana yang dibantu AI.
 */
function LencanaAi() {
  return (
    <Badge variant="outline" className="gap-1 text-[10px]" title="Dari usulan AI yang diterima saat impor">
      <Sparkles className="size-2.5" />
      AI
    </Badge>
  );
}

function Metrik({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums">{nilai}</p>
    </div>
  );
}
