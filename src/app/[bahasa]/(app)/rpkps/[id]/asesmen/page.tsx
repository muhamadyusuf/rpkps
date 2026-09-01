import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps } from "@/lib/rpkps/muat";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import { teksTemuan } from "@/lib/bahasa/temuan";

export const dynamic = "force-dynamic";

export default async function HalamanPetaAsesmen({
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

  const peta = susunPetaAsesmen(keSumberPeta(rpkps));

  // Urutan baris matriks mengikuti urutan kurikulum, bukan urutan kemunculan
  // pada asesmen — supaya susunannya sama dengan yang dibaca dosen di bagian B.
  const baris = rpkps.mataKuliah.cpmk.flatMap((c) =>
    c.subCpmk.map((s) => ({ kode: s.kode, cpmk: c.kode })),
  );
  const dikenal = new Set(baris.map((b) => b.kode));
  for (const kode of Object.keys(peta.bobotSubCpmk)) {
    if (!dikenal.has(kode)) baris.push({ kode, cpmk: "—" });
  }

  const bobotSel = new Map<string, number>();
  for (const a of peta.asesmen) {
    for (const s of a.subCpmk) bobotSel.set(`${a.kode}|${s.kode}`, s.bobot);
  }

  const k = await kamus();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{k.rpkps.asesmen.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.rpkps.asesmen.keterangan}
        </p>
      </header>

      <PanelPeta peta={peta} k={k} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.asesmen.daftarJudul}</CardTitle>
          <CardDescription>
            {k.rpkps.asesmen.daftarKeteranganAwal}{" "}
            <em>{k.rpkps.asesmen.daftarKeteranganAtau}</em>{" "}
            {k.rpkps.asesmen.daftarKeteranganAkhir}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peta.asesmen.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {k.rpkps.asesmen.kosong}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{k.rpkps.asesmen.kolomKode}</TableHead>
                    <TableHead>{k.rpkps.asesmen.kolomNama}</TableHead>
                    <TableHead>{k.rpkps.asesmen.kolomAsal}</TableHead>
                    <TableHead>{k.rpkps.asesmen.kolomKomponen}</TableHead>
                    <TableHead>{k.rpkps.asesmen.kolomMinggu}</TableHead>
                    <TableHead className="text-right">{k.rpkps.asesmen.kolomBobot}</TableHead>
                    <TableHead>{k.rpkps.asesmen.kolomPembagian}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peta.asesmen.map((a) => (
                    <TableRow key={a.kode}>
                      <TableCell className="font-mono text-xs">{a.kode}</TableCell>
                      <TableCell>{a.nama}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {k.enum.asalAsesmen[a.asal]}
                      </TableCell>
                      <TableCell>
                        {a.komponen ?? (
                          <span className="text-destructive">
                            {k.rpkps.asesmen.belumDitunjuk}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ringkasMinggu(a.minggu)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.bobot}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {k.enum.caraPembagian[a.pembagian]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.asesmen.matriksJudul}</CardTitle>
          <CardDescription>{k.rpkps.asesmen.matriksKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sub-CPMK</TableHead>
                  <TableHead>CPMK</TableHead>
                  {peta.asesmen.map((a) => (
                    <TableHead key={a.kode} className="text-right font-mono text-xs">
                      {a.kode}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">{k.rpkps.asesmen.kolomTotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => {
                  const total = peta.bobotSubCpmk[b.kode] ?? 0;
                  return (
                    <TableRow key={b.kode}>
                      <TableCell className="font-mono text-xs">{b.kode}</TableCell>
                      <TableCell className="text-muted-foreground">{b.cpmk}</TableCell>
                      {peta.asesmen.map((a) => {
                        const nilai = bobotSel.get(`${a.kode}|${b.kode}`);
                        return (
                          <TableCell
                            key={a.kode}
                            className="text-right tabular-nums text-muted-foreground"
                          >
                            {nilai ? bulat(nilai) : "·"}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          total > 0 ? "" : "text-destructive"
                        }`}
                      >
                        {bulat(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.asesmen.cplJudul}</CardTitle>
          <CardDescription>{k.rpkps.asesmen.cplKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPL</TableHead>
                  <TableHead className="text-right">
                    {k.rpkps.asesmen.kolomBobotMk}
                  </TableHead>
                  <TableHead>{k.rpkps.asesmen.kolomDijabarkan}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peta.cpl.map((c) => (
                  <TableRow key={c.kode}>
                    <TableCell className="font-mono text-xs">{c.kode}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${c.bobot > 0 ? "" : "text-destructive"}`}
                    >
                      {bulat(c.bobot)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.cpmk.length === 0
                        ? k.rpkps.asesmen.tanpaCpmk
                        : c.cpmk
                            .map((k) => `${k.kode} (${k.kontribusi}%)`)
                            .join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PanelPeta({
  peta,
  k,
}: {
  peta: ReturnType<typeof susunPetaAsesmen>;
  k: Kamus;
}) {
  const { pemblokir, peringatan, ringkasan } = peta;

  return (
    <Card
      className={
        peta.lolos
          ? "border-l-2 border-l-success bg-success/8"
          : "border-l-2 border-l-destructive bg-destructive/8"
      }
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {peta.lolos ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" />
          ) : (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              {peta.lolos
                ? k.rpkps.asesmen.lolos
                : isi(k.rpkps.asesmen.tidakLolos, { jumlah: pemblokir.length })}
            </CardTitle>
            <CardDescription className="mt-1">
              {isi(k.rpkps.asesmen.ringkasan, {
                asesmen: ringkasan.jumlahAsesmen,
                bobot: ringkasan.totalBobot,
                subTerukur: ringkasan.subCpmkTerukur,
                subSeluruh: ringkasan.subCpmkSeluruh,
                cplTerukur: ringkasan.cplTerukur,
                cplDibebankan: ringkasan.cplDibebankan,
              })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {pemblokir.length > 0 || peringatan.length > 0 ? (
        <CardContent className="space-y-4">
          {pemblokir.length > 0 ? (
            <DaftarTemuan
              judul={k.rpkps.asesmen.pemblokir}
              temuan={pemblokir}
              nada="buruk"
             k={k}/>
          ) : null}
          {peringatan.length > 0 ? (
            <DaftarTemuan
              judul={k.rpkps.asesmen.peringatan}
              temuan={peringatan}
              nada="hati-hati"
             k={k}/>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function DaftarTemuan({
  judul,
  temuan,
  nada,
  k,
}: {
  judul: string;
  temuan: TemuanRpkps[];
  nada: "buruk" | "hati-hati";
  k: Kamus;
}) {
  const Ikon = nada === "buruk" ? CircleAlert : TriangleAlert;
  const warna = nada === "buruk" ? "text-destructive" : "text-warning-foreground";

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {judul} ({temuan.length})
      </p>
      <ul className="space-y-2">
        {temuan.map((t, i) => (
          <li key={`${t.kode}-${i}`} className="flex items-start gap-2.5 text-sm">
            <Ikon className={`mt-0.5 size-4 shrink-0 ${warna}`} />
            <div className="min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{t.kode}</span>
                {t.minggu !== undefined ? (
                  <Badge variant="outline" className="text-[10px]">
                    minggu {t.minggu}
                  </Badge>
                ) : null}
              </div>
              <p>{teksTemuan(t, k).pesan}</p>
              {teksTemuan(t, k).saran ? (
                <p className="mt-0.5 text-xs text-muted-foreground">↳ {teksTemuan(t, k).saran}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Membulatkan bobot sel agar matriks tetap terbaca; presisi penuh ada di domain. */
function bulat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function ringkasMinggu(minggu: number[]): string {
  if (minggu.length === 0) return "—";
  if (minggu.length === 1) return String(minggu[0]);
  return `${minggu[0]}–${minggu[minggu.length - 1]}`;
}
