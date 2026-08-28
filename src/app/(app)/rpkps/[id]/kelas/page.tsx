import { notFound } from "next/navigation";
import { ArrowLeft, Download, LineChart, Users } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </ButtonLink>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Kelas dan nilai</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ketercapaian selalu milik kelas, bukan milik dokumen rencana. Satu
          RPKPS dapat dipakai beberapa kelas dengan dosen berbeda, dan sebaran
          antar kelas itu sendiri adalah temuan.
        </p>
      </header>

      {peta.asesmen.length === 0 ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          Belum ada asesmen berbobot pada RPKPS ini, sehingga templat nilainya
          masih kosong. Susun bobot pada rencana mingguan lebih dulu.
        </p>
      ) : !peta.lolos ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          Nilai boleh dimasukkan sekarang, tetapi{" "}
          <a className="underline underline-offset-2" href={`/rpkps/${id}/asesmen`}>
            peta asesmen
          </a>{" "}
          masih memuat {peta.pemblokir.length} temuan — capaian belum dapat
          dihitung sampai bobotnya tertutup.
        </p>
      ) : null}

      {bolehKelola ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tambah kelas</CardTitle>
            <CardDescription>
              Kode kelas mengikuti kebiasaan prodi — &quot;A&quot;, &quot;B&quot;,
              atau &quot;Pagi&quot;.
            </CardDescription>
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
            Belum ada kelas. Buat satu kelas lebih dulu, lalu unduh templat
            nilainya — kolomnya diturunkan dari peta asesmen RPKPS ini.
          </p>
        </div>
      ) : null}

      {kelas.map((k) => {
        const selSeluruh = k.peserta.length * peta.asesmen.length;
        const selTerisi = k.peserta.reduce((s, p) => s + p.nilai.length, 0);
        const persen = selSeluruh === 0 ? 0 : Math.round((selTerisi / selSeluruh) * 100);

        return (
          <Card key={k.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    Kelas {k.kode}
                    <Badge variant="outline">{k.peserta.length} peserta</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {k.dosen ? k.dosen.nama : "Dosen belum ditentukan"} ·{" "}
                    {selTerisi} dari {selSeluruh} sel nilai terisi ({persen}%)
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ButtonLink variant="outline" size="sm" href={`/rpkps/${id}/kelas/${k.id}`}>
                    <LineChart />
                    Evaluasi
                  </ButtonLink>
                  <ButtonLink
                    variant="outline"
                    size="sm"
                    href={`/api/rpkps/${id}/kelas/${k.id}/templat`}
                    prefetch={false}
                  >
                    <Download />
                    Templat nilai
                  </ButtonLink>
                  {bolehKelola ? <UnggahNilai kelasId={k.id} /> : null}
                  {bolehKelola && selTerisi === 0 ? (
                    <TombolHapusKelas kelasId={k.id} kode={k.kode} />
                  ) : null}
                </div>
              </div>
            </CardHeader>

            {k.peserta.length > 0 ? (
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIM</TableHead>
                        <TableHead>Nama</TableHead>
                        {peta.asesmen.map((a) => (
                          <TableHead key={a.kode} className="text-right font-mono text-xs">
                            {a.kode}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {k.peserta.map((p) => {
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
