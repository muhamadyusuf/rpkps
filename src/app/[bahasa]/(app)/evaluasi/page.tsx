import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { CircleAlert, Download, LineChart, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { muatBarisCapaian, muatKonteksProdi } from "@/lib/evaluasi/muat";
import { agregasiProdi } from "@/domain/evaluasi/agregasi";
import { teksTemuan } from "@/lib/bahasa/temuan";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).evaluasi.metaJudul };
}

const AMBANG_PRODI = 85;

export default async function HalamanEvaluasiProdi({
  searchParams,
}: {
  searchParams: Promise<{ prodi?: string }>;
}) {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);
  const { prodi: prodiDipilih } = await searchParams;

  const daftarProdi = await prisma.prodi.findMany({
    where: cakupan === null ? { aktif: true } : { id: { in: cakupan } },
    orderBy: { kode: "asc" },
    select: { id: true, kode: true, nama: true },
  });

  const prodi =
    daftarProdi.find((p) => p.id === prodiDipilih) ?? daftarProdi[0] ?? null;

  const kurikulum = prodi ? await muatKonteksProdi(prodi.id) : null;
  const baris = prodi ? await muatBarisCapaian(prodi.id) : [];

  const agregasi = agregasiProdi({
    baris,
    cplProdi: kurikulum?.cpl.map((c) => c.kode) ?? [],
    jumlahMkKurikulum: kurikulum?._count.mataKuliah ?? 0,
    ambangKetercapaian: AMBANG_PRODI,
  });

  const deskripsi = new Map((kurikulum?.cpl ?? []).map((c) => [c.kode, c.deskripsi]));

  const tahunTren = [
    ...new Set(
      [...agregasi.tren.values()].flat().map((t) => `${t.tahunMulai}|${t.tahunAkademik}`),
    ),
  ]
    .sort()
    .map((x) => x.split("|")[1]);

  const k = await kamus();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-teknis mb-2 text-muted-foreground/70">
            {k.evaluasi.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{k.evaluasi.judul}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{k.evaluasi.keterangan}</p>
        </div>
        {prodi ? (
          <ButtonLink
            variant="outline"
            href={`/api/evaluasi/${prodi.id}/lkps`}
            prefetch={false}
          >
            <Download />
            {k.evaluasi.unduhLkps}
          </ButtonLink>
        ) : null}
      </header>

      {daftarProdi.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {daftarProdi.map((p) => (
            <Tautan
              key={p.id}
              href={`/evaluasi?prodi=${p.id}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                p.id === prodi?.id ? "bg-muted font-medium" : "text-muted-foreground"
              }`}
            >
              {p.kode}
            </Tautan>
          ))}
        </div>
      ) : null}

      {!prodi || !kurikulum ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <LineChart className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            {k.evaluasi.tanpaKurikulum}
          </p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isi(k.evaluasi.kartuJudul, {
                  prodi: prodi.nama,
                  kurikulum: kurikulum.nama,
                })}
              </CardTitle>
              <CardDescription>
                {isi(k.evaluasi.rumus, { ambang: AMBANG_PRODI })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Angka
                  label={k.evaluasi.cplTerukur}
                  nilai={`${agregasi.ringkasan.cplTerukur} / ${agregasi.ringkasan.cplDibebankan}`}
                />
                <Angka
                  label={k.evaluasi.cakupanMk}
                  nilai={`${agregasi.ringkasan.cakupanPersen}%`}
                />
                <Angka
                  label={k.evaluasi.mkDievaluasi}
                  nilai={String(agregasi.ringkasan.mkDievaluasi)}
                />
                <Angka
                  label={k.evaluasi.kelasDievaluasi}
                  nilai={String(agregasi.ringkasan.kelasDievaluasi)}
                />
              </dl>
            </CardContent>
          </Card>

          {agregasi.temuan.length > 0 ? (
            <Card className="border-l-2 border-l-warning bg-warning/8">
              <CardHeader>
                <CardTitle className="text-base">
                  {isi(k.evaluasi.temuanJudul, { jumlah: agregasi.temuan.length })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {agregasi.temuan.map((t, i) => (
                    <li key={`${t.kode}-${i}`} className="flex items-start gap-2.5 text-sm">
                      {t.tingkat === "PEMBLOKIR" ? (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                      )}
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.kode}
                        </span>
                        <p>{teksTemuan(t, k).pesan}</p>
                        {teksTemuan(t, k).saran ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">↳ {teksTemuan(t, k).saran}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{k.evaluasi.perCplJudul}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPL</TableHead>
                      <TableHead className="text-right">{k.evaluasi.kolomRerata}</TableHead>
                      <TableHead className="text-right">{k.evaluasi.kolomLulus}</TableHead>
                      <TableHead className="text-right">{k.evaluasi.kolomKelas}</TableHead>
                      <TableHead>{k.evaluasi.kolomMk}</TableHead>
                      <TableHead>{k.evaluasi.kolomStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agregasi.cpl.map((c) => (
                      <TableRow key={c.kode}>
                        <TableCell>
                          <div className="font-mono text-xs">{c.kode}</div>
                          <div className="max-w-md text-xs text-muted-foreground">
                            {deskripsi.get(c.kode)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.rerata ?? "·"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.persenLulus === null ? "·" : `${c.persenLulus}%`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {c.kelasTercapai}/{c.kelasTerukur}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.mkTerukur.join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {c.kelasTerukur === 0 ? (
                            <span className="text-destructive">
                              {k.evaluasi.belumTerukur}
                            </span>
                          ) : (c.persenLulus ?? 0) >= AMBANG_PRODI ? (
                            <span className="text-success-foreground">
                              {k.evaluasi.tercapai}
                            </span>
                          ) : (
                            <span className="text-warning-foreground">
                              {k.evaluasi.belumTercapai}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {tahunTren.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{k.evaluasi.trenJudul}</CardTitle>
                <CardDescription>{k.evaluasi.trenKeterangan}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CPL</TableHead>
                        {tahunTren.map((t) => (
                          <TableHead key={t} className="text-right">
                            {t.replace("-", " ")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agregasi.cpl.map((c) => {
                        const titik = new Map(
                          (agregasi.tren.get(c.kode) ?? []).map((t) => [
                            t.tahunAkademik,
                            t.persenLulus,
                          ]),
                        );
                        return (
                          <TableRow key={c.kode}>
                            <TableCell className="font-mono text-xs">{c.kode}</TableCell>
                            {tahunTren.map((t) => {
                              const n = titik.get(t);
                              return (
                                <TableCell
                                  key={t}
                                  className="text-right tabular-nums text-muted-foreground"
                                >
                                  {n === undefined || n === null ? "·" : `${n}%`}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {agregasi.sebaran.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{k.evaluasi.sebaranJudul}</CardTitle>
                <CardDescription>{k.evaluasi.sebaranKeterangan}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{k.evaluasi.kolomMk}</TableHead>
                        <TableHead>CPL</TableHead>
                        <TableHead>{k.evaluasi.kolomTahunAkademik}</TableHead>
                        <TableHead>{k.evaluasi.kolomTertinggi}</TableHead>
                        <TableHead>{k.evaluasi.kolomTerendah}</TableHead>
                        <TableHead className="text-right">{k.evaluasi.kolomSelisih}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agregasi.sebaran.map((s, i) => (
                        <TableRow key={`${s.mkKode}-${s.cplKode}-${i}`}>
                          <TableCell className="font-mono text-xs">{s.mkKode}</TableCell>
                          <TableCell className="font-mono text-xs">{s.cplKode}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.tahunAkademik.replace("-", " ")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {s.tertinggi.kelas} · {s.tertinggi.persenLulus}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {s.terendah.kelas} · {s.terendah.persenLulus}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {s.selisih}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{nilai}</dd>
    </div>
  );
}
