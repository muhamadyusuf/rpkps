import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, pilihTeks } from "@/lib/bahasa/teks";
import { notFound } from "next/navigation";
import { ArrowLeft, GitPullRequestArrow, Lock, Sparkles, UserRoundCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { bolehSuntingKurikulum } from "@/domain/kurikulum/sunting";
import { PengelolaCapaian } from "./capaian";
import { infoLevel, type LevelBloom } from "@/domain/kurikulum/bloom";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
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

  const [mk, kebijakanBaris, usulanTerbuka, penugasan] = await Promise.all([
    prisma.mataKuliah.findUnique({
      where: { id: mkId },
      include: {
        kurikulum: {
          select: {
            id: true,
            nama: true,
            tahun: true,
            prodiId: true,
            status: true,
            prodi: { select: { kode: true } },
            cpl: {
              orderBy: { urutan: "asc" },
              select: { id: true, kode: true, deskripsi: true, deskripsiEn: true },
            },
          },
        },
        cpl: {
          include: {
            cpl: { select: { id: true, kode: true, deskripsi: true, deskripsiEn: true } },
          },
        },
        cpmk: {
          orderBy: { urutan: "asc" },
          include: {
            cpl: { include: { cpl: { select: { id: true, kode: true } } } },
            subCpmk: { orderBy: { urutan: "asc" } },
          },
        },
      },
    }),
    prisma.kebijakanBebanBelajar.findFirst({
      orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
      include: { bentuk: true },
    }),
    // Usulan yang masih bergerak. Ditampilkan di sini supaya dosen yang
    // menemukan rumusan janggal tahu apakah sudah ada yang mengusulkannya.
    prisma.usulanRevisi.findMany({
      where: {
        mataKuliahId: mkId,
        status: { in: ["DRAF", "DIAJUKAN", "DIREVISI"] },
      },
      orderBy: { diubahPada: "desc" },
      select: { id: true, judul: true, status: true },
    }),
    /**
     * Pemegang mata kuliah ini, beberapa tahun akademik terakhir. Baca-saja:
     * halaman ini tempat orang bertanya "siapa yang pegang ini?", sedangkan
     * membaginya dilakukan di papan penugasan (docs/13 §2.4).
     */
    prisma.koordinatorMk.findMany({
      where: { mataKuliahId: mkId },
      orderBy: [
        { tahunAkademik: { tahunMulai: "desc" } },
        { tahunAkademik: { semester: "asc" } },
      ],
      take: 4,
      select: {
        tahunAkademik: { select: { kode: true, aktif: true } },
        pengguna: {
          select: { nama: true, gelarDepan: true, gelarBelakang: true, status: true },
        },
      },
    }),
  ]);

  if (!mk || mk.kurikulum.id !== id) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(mk.kurikulum.prodiId)) notFound();

  // G1 (docs/15 §2.2). Diperiksa ulang di tiap aksi — halaman hanya memutuskan
  // apa yang dirender.
  const bolehSunting =
    punyaPeran(sesi, "ADMIN", "KAPRODI") && bolehSuntingKurikulum(mk.kurikulum.status).boleh;

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

  const k = await kamus();
  const b = await bahasaAktif();

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {pilihTeks(mk.nama, mk.namaEn, b).teks}
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isi(k.kurikulum.mk.ringkasan, {
            semester: mk.semester,
            sks: mk.sksTeori + mk.sksPraktik,
            teori: mk.sksTeori,
            praktik: mk.sksPraktik,
            prodi: mk.kurikulum.prodi.kode,
          })}
        </p>
      </header>

      {bolehSunting ? null : (
      <div className="flex flex-wrap items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-muted-foreground">
          {k.kurikulum.mk.readOnlyAwal} <strong>{k.kurikulum.mk.readOnlyTebal}</strong>{" "}
          {k.kurikulum.mk.readOnlyAkhir}
        </p>
        <ButtonLink size="sm" variant="outline" href={`/usulan/baru?mk=${mk.id}`}>
          <GitPullRequestArrow />
          {k.kurikulum.mk.usulkanRevisi}
        </ButtonLink>
      </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {k.kurikulum.mk.koordinatorJudul}
              </CardTitle>
              <CardDescription>{k.kurikulum.mk.koordinatorKeterangan}</CardDescription>
            </div>
            <ButtonLink variant="outline" size="sm" href={`/kurikulum/${id}/koordinator`}>
              <UserRoundCog />
              {k.kurikulum.mk.aturPenugasan}
            </ButtonLink>
          </div>
        </CardHeader>
        <CardContent>
          {penugasan.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {k.kurikulum.mk.koordinatorKosong}
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {penugasan.map((p) => (
                <li key={p.tahunAkademik.kode} className="flex flex-wrap items-center gap-2">
                  <span className="w-40 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {p.tahunAkademik.kode.replace("-", " ")}
                  </span>
                  <span>{namaLengkapPengampu(p.pengguna)}</span>
                  {p.tahunAkademik.aktif ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {k.kurikulum.mk.berjalan}
                    </Badge>
                  ) : null}
                  {p.pengguna.status !== "AKTIF" ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {k.kurikulum.mk.nonaktif}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {usulanTerbuka.length > 0 ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="label-teknis text-muted-foreground/80">
            {isi(k.kurikulum.mk.usulanBerjalan, { jumlah: usulanTerbuka.length })}
          </p>
          <ul className="mt-1.5 space-y-1">
            {usulanTerbuka.map((u) => (
              <li key={u.id}>
                <Tautan href={`/usulan/${u.id}`} className="hover:underline">
                  {u.judul}
                </Tautan>
                <span className="text-muted-foreground"> · {u.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pagu ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.kurikulum.mk.paguJudul}</CardTitle>
            <CardDescription>{k.kurikulum.mk.paguKeterangan}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <Metrik label={k.kurikulum.mk.paguTotal} nilai={formatMenit(pagu.total)} />
              <Metrik label={k.kurikulum.mk.paguTm} nilai={formatMenit(pagu.tm)} />
              <Metrik
                label={k.kurikulum.mk.paguTerjadwal}
                nilai={formatMenit(pagu.terjadwal)}
              />
              <Metrik
                label={k.kurikulum.mk.paguRuangKhusus}
                nilai={pagu.ruangKhusus > 0 ? formatMenit(pagu.ruangKhusus) : "—"}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bolehSunting ? (
        <PengelolaCapaian
          mataKuliahId={mk.id}
          cplMk={mk.cpl.map((m) => ({
            id: m.cpl.id,
            kode: m.cpl.kode,
            deskripsi: m.cpl.deskripsi,
            deskripsiEn: m.cpl.deskripsiEn,
          }))}
          cplKurikulum={mk.kurikulum.cpl}
          daftar={mk.cpmk.map((c) => ({
            id: c.id,
            kode: c.kode,
            rumusan: c.rumusan,
            rumusanEn: c.rumusanEn,
            levelBloom: c.levelBloom,
            sumber: c.sumber,
            pensiun: c.pensiunSejakTaId !== null,
            cplId: c.cpl.map((x) => x.cpl.id),
            subCpmk: c.subCpmk.map((s) => ({
              id: s.id,
              kode: s.kode,
              rumusan: s.rumusan,
              rumusanEn: s.rumusanEn,
              levelBloom: s.levelBloom,
              kko: s.kko,
              mingguDisarankan: s.mingguDisarankan,
              sumber: s.sumber,
              pensiun: s.pensiunSejakTaId !== null,
            })),
          }))}
        />
      ) : (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kurikulum.mk.cplJudul}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mk.cpl.map((m) => (
            <div key={m.cplId} className="border-b pb-3 last:border-0 last:pb-0">
              <Badge variant="outline">{m.cpl.kode}</Badge>
              <p className="mt-1 text-sm">
                {pilihTeks(m.cpl.deskripsi, m.cpl.deskripsiEn, b).teks}
              </p>
            </div>
          ))}
          {mk.cpl.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.kurikulum.mk.cplKosong}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {isi(k.kurikulum.mk.cpmkJudul, { jumlah: mk.cpmk.length })}
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
                {c.sumber === "AI" ? <LencanaAi judul={k.kurikulum.mk.lencanaAi} /> : null}
                {c.pensiunSejakTaId ? (
                  <LencanaPensiun
                    judul={k.kurikulum.mk.lencanaPensiunJudul}
                    label={k.kurikulum.mk.lencanaPensiun}
                  />
                ) : null}
              </div>
              <CardDescription className="mt-2 text-foreground">
                {pilihTeks(c.rumusan, c.rumusanEn, b).teks}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {c.subCpmk.length === 0 ? (
                <p className="text-sm text-destructive">
                  {k.kurikulum.mk.subKosong}
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
                        {s.sumber === "AI" ? (
                          <LencanaAi judul={k.kurikulum.mk.lencanaAi} />
                        ) : null}
                        {s.pensiunSejakTaId ? (
                          <LencanaPensiun
                            judul={k.kurikulum.mk.lencanaPensiunJudul}
                            label={k.kurikulum.mk.lencanaPensiun}
                          />
                        ) : null}
                      </div>
                      <p className="min-w-0 flex-1 pt-0.5">
                        {pilihTeks(s.rumusan, s.rumusanEn, b).teks}
                      </p>
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
              {k.kurikulum.mk.cpmkKosong}
            </CardContent>
          </Card>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}

/**
 * Jejak asal isi (docs/01 §4.8). Rumusan hasil usulan AI yang diterima saat
 * impor ditandai terbuka — asesor berhak tahu bagian mana yang dibantu AI.
 */
function LencanaAi({ judul }: { judul: string }) {
  return (
    <Badge variant="outline" className="gap-1 text-[10px]" title={judul}>
      <Sparkles className="size-2.5" />
      AI
    </Badge>
  );
}

/**
 * Capaian yang sudah dipensiunkan lewat usulan revisi. Tetap ditampilkan —
 * RPKPS lama merujuknya, dan asesor perlu melihat riwayatnya.
 */
function LencanaPensiun({ judul, label }: { judul: string; label: string }) {
  return (
    <Badge variant="outline" className="text-[10px]" title={judul}>
      {label}
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
