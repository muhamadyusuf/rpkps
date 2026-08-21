import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { formatMenit, susunRencanaSemester, bulatkan } from "@/domain/beban-belajar/kalkulator";

export const dynamic = "force-dynamic";

export default async function HalamanMingguan({
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
  const rencana = susunRencanaSemester(kebijakan, {
    sksTeori: rpkps.mataKuliah.sksTeori,
    sksPraktik: rpkps.mataKuliah.sksPraktik,
    bentukTeori: rpkps.mataKuliah.bentukTeori,
    bentukPraktik: rpkps.mataKuliah.bentukPraktik,
  });
  const paguPerMinggu = new Map(rencana.minggu.map((m) => [m.minggu, m.pagu]));

  const totalTerpakai = rpkps.pertemuan.reduce(
    (s, p) => s + p.aktivitas.reduce((t, a) => t + a.menit, 0),
    0,
  );
  const sksTotal = rpkps.mataKuliah.sksTeori + rpkps.mataKuliah.sksPraktik;
  const jamPerSks = bulatkan(totalTerpakai / 60 / sksTotal, 2);
  const totalBobot = bulatkan(
    rpkps.pertemuan.reduce((s, p) => s + Number(p.bobot), 0),
    2,
  );

  const selisihPersen =
    rencana.targetMenit === 0
      ? 0
      : bulatkan(((totalTerpakai - rencana.targetMenit) / rencana.targetMenit) * 100, 2);
  const semesterPas = Math.abs(selisihPersen) <= kebijakan.toleransiSemesterPersen;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rencana Pembelajaran Mingguan</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Klik nomor minggu untuk menyunting. Neraca waktu dihitung ulang setiap
          kali disimpan.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Neraca waktu semester</CardTitle>
          <CardDescription>
            Target {kebijakan.jamPerSksPerSemester} jam per sks, toleransi ±
            {kebijakan.toleransiSemesterPersen}%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metrik label="Terpakai" nilai={formatMenit(totalTerpakai)} />
            <Metrik label="Target" nilai={formatMenit(rencana.targetMenit)} />
            <Metrik
              label="Per sks"
              nilai={`${jamPerSks} jam`}
              nada={semesterPas ? "baik" : "buruk"}
            />
            <Metrik
              label="Total bobot"
              nilai={`${totalBobot}%`}
              nada={Math.abs(totalBobot - 100) < 0.01 ? "baik" : "buruk"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Mg</TableHead>
                  <TableHead className="min-w-40">Sub-CPMK</TableHead>
                  <TableHead className="min-w-48">Topik</TableHead>
                  <TableHead className="min-w-36">Alokasi waktu</TableHead>
                  <TableHead className="min-w-32">Penilaian</TableHead>
                  <TableHead className="w-16 text-right">Bobot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rpkps.pertemuan.map((p) => {
                  const pagu = paguPerMinggu.get(p.minggu);
                  const terpakai = p.aktivitas.reduce((s, a) => s + a.menit, 0);
                  const selisih = pagu ? terpakai - pagu.total : 0;
                  const persen =
                    pagu && pagu.total > 0 ? Math.abs((selisih / pagu.total) * 100) : 0;
                  const pas = persen <= kebijakan.toleransiPertemuanPersen;
                  const tm = p.aktivitas.filter((a) => a.kategori === "TM").reduce((s, a) => s + a.menit, 0);
                  const pt = p.aktivitas.filter((a) => a.kategori === "PT").reduce((s, a) => s + a.menit, 0);
                  const bm = p.aktivitas.filter((a) => a.kategori === "BM").reduce((s, a) => s + a.menit, 0);

                  return (
                    <TableRow key={p.id} className={p.jenis !== "EFEKTIF" ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <Link
                          href={`/rpkps/${id}/mingguan/${p.minggu}`}
                          className="font-medium tabular-nums underline-offset-4 hover:underline"
                        >
                          {p.minggu}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.subCpmk.map((s) => (
                            <Badge key={s.subCpmkId} variant="outline" className="font-mono text-[10px]">
                              {s.subCpmk.kode}
                            </Badge>
                          ))}
                          {p.subCpmk.length === 0 && p.jenis === "EFEKTIF" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.topik ?? <span className="text-muted-foreground">belum diisi</span>}
                        {p.subtopik.length > 0 ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {p.subtopik.length} subtopik
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs tabular-nums">
                          <span className={pas ? "" : "font-medium text-destructive"}>
                            {formatMenit(terpakai)}
                          </span>
                          {pagu ? (
                            <span className="text-muted-foreground">
                              {" "}
                              / {formatMenit(pagu.total)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          TM {tm}′ · PT {pt}′ · BM {bm}′
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.penilaianJenis ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Number(p.bobot)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metrik({
  label,
  nilai,
  nada,
}: {
  label: string;
  nilai: string;
  nada?: "baik" | "buruk";
}) {
  const warna =
    nada === "baik" ? "text-success" : nada === "buruk" ? "text-destructive" : "";
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p
        className={`mt-1.5 font-mono text-lg leading-none font-semibold tabular-nums ${warna}`}
      >
        {nilai}
      </p>
    </div>
  );
}
