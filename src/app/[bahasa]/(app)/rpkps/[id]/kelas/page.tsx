import { notFound } from "next/navigation";
import { ArrowLeft, Download, LineChart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
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
import { muatRpkps, namaLengkapPengampu } from "@/lib/rpkps/muat";
import { muatKelasRpkps } from "@/lib/evaluasi/muat";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { FormulirKelas, TombolHapusKelas, UnggahNilai } from "./pengelola";

export const dynamic = "force-dynamic";

export default async function HalamanKelas({
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
  const kelas = await muatKelasRpkps(id);

  const bolehKelola = wenang.boleh;

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
        <h1 className="text-2xl font-semibold tracking-tight">{k.rpkps.kelas.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.rpkps.kelas.keterangan}
        </p>
      </header>

      {peta.asesmen.length === 0 ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          {k.rpkps.kelas.tanpaAsesmen}
        </p>
      ) : !peta.lolos ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          {k.rpkps.kelas.petaBelumLolosAwal}{" "}
          <a className="underline underline-offset-2" href={`/rpkps/${id}/asesmen`}>
            {k.rpkps.kelas.petaTautan}
          </a>{" "}
          {isi(k.rpkps.kelas.petaBelumLolosAkhir, { jumlah: peta.pemblokir.length })}
        </p>
      ) : null}

      {bolehKelola ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.kelas.tambahJudul}</CardTitle>
            <CardDescription>{k.rpkps.kelas.tambahKeterangan}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormulirKelas
              rpkpsId={id}
              pengampu={rpkps.pengampu.map((p) => ({
                id: p.pengguna.id,
                nama: namaLengkapPengampu(p.pengguna),
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {kelas.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            {k.rpkps.kelas.kosong}
          </p>
        </div>
      ) : null}

      {kelas.map((kls) => {
        const selSeluruh = kls.peserta.length * peta.asesmen.length;
        const selTerisi = kls.peserta.reduce((s, p) => s + p.nilai.length, 0);
        const persen = selSeluruh === 0 ? 0 : Math.round((selTerisi / selSeluruh) * 100);

        return (
          <Card key={kls.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {isi(k.rpkps.kelas.kelasKe, { kode: kls.kode })}
                    <Badge variant="outline">
                      {isi(k.rpkps.kelas.jumlahPeserta, { jumlah: kls.peserta.length })}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {kls.dosen ? kls.dosen.nama : k.rpkps.kelas.dosenKosong} ·{" "}
                    {isi(k.rpkps.kelas.selTerisi, {
                      terisi: selTerisi,
                      seluruh: selSeluruh,
                      persen,
                    })}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ButtonLink
                    variant="outline"
                    size="sm"
                    href={`/rpkps/${id}/kelas/${kls.id}`}
                  >
                    <LineChart />
                    {k.rpkps.kelas.evaluasi}
                  </ButtonLink>
                  <ButtonLink
                    variant="outline"
                    size="sm"
                    href={`/api/rpkps/${id}/kelas/${kls.id}/templat`}
                    prefetch={false}
                  >
                    <Download />
                    {k.rpkps.kelas.templatNilai}
                  </ButtonLink>
                  {bolehKelola ? <UnggahNilai kelasId={kls.id} /> : null}
                  {bolehKelola && selTerisi === 0 ? (
                    <TombolHapusKelas kelasId={kls.id} kode={kls.kode} />
                  ) : null}
                </div>
              </div>
            </CardHeader>

            {kls.peserta.length > 0 ? (
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{k.rpkps.kelas.kolomNim}</TableHead>
                        <TableHead>{k.rpkps.kelas.kolomNama}</TableHead>
                        {peta.asesmen.map((a) => (
                          <TableHead key={a.kode} className="text-right font-mono text-xs">
                            {a.kode}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kls.peserta.map((p) => {
                        const nilai = new Map(
                          p.nilai.map((n) => [n.asesmenKode, Number(n.skor)]),
                        );
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">
                              {p.mahasiswa.nim}
                            </TableCell>
                            <TableCell>{p.mahasiswa.nama}</TableCell>
                            {peta.asesmen.map((a) => {
                              const n = nilai.get(a.kode);
                              return (
                                <TableCell
                                  key={a.kode}
                                  className={`text-right tabular-nums ${
                                    n === undefined ? "text-muted-foreground" : ""
                                  }`}
                                >
                                  {n === undefined ? "·" : n}
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
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
