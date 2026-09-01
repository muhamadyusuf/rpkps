import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
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
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { formatMenit, susunRencanaSemester, bulatkan } from "@/domain/beban-belajar/kalkulator";
import { AksiBaris, TombolSusunUlang, TombolTambahPertemuan } from "./tombol";

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

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

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

  /**
   * Struktur tabel hanya dapat diubah selama dokumen masih berupa draf
   * (docs/09 §K1). Sesudah diajukan, isinya pun sudah terkunci.
   */
  const bisaSunting =
    wenang.boleh && (rpkps.status === "DRAF" || rpkps.status === "DIREVISI");
  const mingguMaksimum = kebijakan.mingguPerSemester;

  const selisihPersen =
    rencana.targetMenit === 0
      ? 0
      : bulatkan(((totalTerpakai - rencana.targetMenit) / rencana.targetMenit) * 100, 2);
  const semesterPas = Math.abs(selisihPersen) <= kebijakan.toleransiSemesterPersen;

  const k = await kamus();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {k.rpkps.mingguan.judul}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {k.rpkps.mingguan.keterangan}
          </p>
        </div>
        {bisaSunting ? (
          <div className="flex flex-wrap items-center gap-1">
            <TombolSusunUlang rpkpsId={id} />
            <TombolTambahPertemuan rpkpsId={id} />
          </div>
        ) : null}
      </header>

      {bisaSunting ? null : (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            {wenang.boleh ? k.rpkps.mingguan.terkunci : k.rpkps.mingguan.hanyaBaca}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.mingguan.neracaJudul}</CardTitle>
          <CardDescription>
            {isi(k.rpkps.mingguan.neracaKeterangan, {
              jam: kebijakan.jamPerSksPerSemester,
              toleransi: kebijakan.toleransiSemesterPersen,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metrik
              label={k.rpkps.mingguan.terpakai}
              nilai={formatMenit(totalTerpakai)}
            />
            <Metrik
              label={k.rpkps.mingguan.target}
              nilai={formatMenit(rencana.targetMenit)}
            />
            <Metrik
              label={k.rpkps.mingguan.perSks}
              nilai={isi(k.rpkps.mingguan.perSksNilai, { jam: jamPerSks })}
              nada={semesterPas ? "baik" : "buruk"}
            />
            <Metrik
              label={k.rpkps.mingguan.totalBobot}
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
                  <TableHead className="w-14">{k.rpkps.mingguan.kolomMg}</TableHead>
                  <TableHead className="min-w-40">Sub-CPMK</TableHead>
                  <TableHead className="min-w-48">{k.rpkps.mingguan.kolomTopik}</TableHead>
                  <TableHead className="min-w-36">
                    {k.rpkps.mingguan.kolomAlokasi}
                  </TableHead>
                  <TableHead className="min-w-32">
                    {k.rpkps.mingguan.kolomPenilaian}
                  </TableHead>
                  <TableHead className="w-16 text-right">
                    {k.rpkps.mingguan.kolomBobot}
                  </TableHead>
                  {/* Kolom aksi ada bagi siapa pun: membuka rincian bukan
                      penyuntingan, dan pembaca pun perlu jalan ke sana. */}
                  <TableHead className="w-36 text-right">{k.rpkps.mingguan.kolomAksi}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rpkps.pertemuan.map((p, indeks) => {
                  const pagu = paguPerMinggu.get(p.minggu);
                  const terpakai = p.aktivitas.reduce((s, a) => s + a.menit, 0);
                  const selisih = pagu ? terpakai - pagu.total : 0;
                  const persen =
                    pagu && pagu.total > 0 ? Math.abs((selisih / pagu.total) * 100) : 0;
                  const pas = persen <= kebijakan.toleransiPertemuanPersen;
                  const tm = p.aktivitas.filter((a) => a.kategori === "TM").reduce((s, a) => s + a.menit, 0);
                  const pt = p.aktivitas.filter((a) => a.kategori === "PT").reduce((s, a) => s + a.menit, 0);
                  const bm = p.aktivitas.filter((a) => a.kategori === "BM").reduce((s, a) => s + a.menit, 0);

                  const diLuarSemester = p.minggu > mingguMaksimum;

                  return (
                    <TableRow key={p.id} className={p.jenis !== "EFEKTIF" ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <Tautan
                          href={`/rpkps/${id}/mingguan/${p.minggu}`}
                          className="font-medium tabular-nums underline-offset-4 hover:underline"
                        >
                          {p.minggu}
                        </Tautan>
                        {diLuarSemester ? (
                          <p
                            className="text-[10px] text-warning"
                            title={isi(k.rpkps.mingguan.diLuarJudul, {
                              maks: mingguMaksimum,
                            })}
                          >
                            {k.rpkps.mingguan.diLuar}
                          </p>
                        ) : null}
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
                        {p.topik ?? (
                          <span className="text-muted-foreground">
                            {k.rpkps.mingguan.belumDiisi}
                          </span>
                        )}
                        {p.subtopik.length > 0 ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isi(k.rpkps.mingguan.jumlahSubtopik, {
                              jumlah: p.subtopik.length,
                            })}
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
                      <TableCell>
                        <AksiBaris
                          rpkpsId={id}
                          minggu={p.minggu}
                          bisaSunting={bisaSunting}
                          bisaNaik={indeks > 0}
                          bisaTurun={indeks < rpkps.pertemuan.length - 1}
                          bisaHapus={rpkps.pertemuan.length > 1}
                          rincian={rincianIsi(p, k)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rpkps.pertemuan.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {k.rpkps.mingguan.kosongAwal}{" "}
                {bisaSunting
                  ? k.rpkps.mingguan.kosongDapatSunting
                  : k.rpkps.mingguan.kosongBacaSaja}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Kalimat isi baris untuk dialog hapus. Empat tabel anak ikut lenyap lewat
 * `onDelete: Cascade`, dan hilangnya senyap — dialog harus menyebut jumlahnya,
 * bukan sekadar bertanya "Anda yakin?" (docs/09 §K2).
 */
function rincianIsi(
  p: {
    aktivitas: unknown[];
    indikator: unknown[];
    subCpmk: unknown[];
    pustaka: unknown[];
    subtopik: unknown[];
  },
  k: Kamus,
): string {
  const m = k.rpkps.mingguan;
  return [
    isi(m.rincianAktivitas, { jumlah: p.aktivitas.length }),
    isi(m.rincianIndikator, { jumlah: p.indikator.length }),
    isi(m.rincianSubCpmk, { jumlah: p.subCpmk.length }),
    isi(m.rincianPustaka, { jumlah: p.pustaka.length }),
    isi(m.rincianSubtopik, { jumlah: p.subtopik.length }),
  ].join(", ");
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
