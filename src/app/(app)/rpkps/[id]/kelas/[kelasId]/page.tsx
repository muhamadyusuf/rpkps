import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Download, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps, namaLengkapPengampu } from "@/lib/rpkps/muat";
import { muatKelasEvaluasi, muatTemuanBelumDiverifikasi } from "@/lib/evaluasi/muat";
import { ambilSnapshotEvaluasi } from "@/lib/evaluasi/evaluasi-inti";
import { keSumberPeta, kePesertaCapaian } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { hitungCapaian, type CapaianButir } from "@/domain/evaluasi/capaian";
import { nilaiVerifikasi, periksaPenutupan } from "@/domain/evaluasi/tindak-lanjut";
import { analisisButir } from "@/domain/evaluasi/analisis-butir";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import {
  CatatanProses,
  FormulirTemuan,
  TombolHapusTemuan,
  TombolPenutupan,
  TombolTeruskan,
  Verifikasi,
} from "./pengelola";

export const dynamic = "force-dynamic";

const LABEL_TINGKAT: Record<string, string> = {
  SUB_CPMK: "Sub-CPMK",
  CPMK: "CPMK",
  CPL: "CPL",
};

export default async function HalamanEvaluasi({
  params,
}: {
  params: Promise<{ id: string; kelasId: string }>;
}) {
  const sesi = await wajibAktif();
  const { id, kelasId } = await params;

  const kelas = await muatKelasEvaluasi(kelasId);
  if (!kelas || kelas.rpkps.id !== id) notFound();

  const rpkps = await muatRpkps(id);
  if (!rpkps) notFound();

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  const peta = susunPetaAsesmen(keSumberPeta(rpkps));
  const evaluasi = kelas.evaluasi;
  const ditutup = evaluasi?.status === "DITUTUP";

  const hasil = hitungCapaian({
    asesmen: peta.asesmen,
    cpmk: rpkps.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      subCpmkKode: c.subCpmk.map((s) => s.kode),
      cplKode: c.cpl.map((m) => m.cpl.kode),
    })),
    cplDibebankan: rpkps.mataKuliah.cpl.map((m) => m.cpl.kode),
    peserta: kePesertaCapaian(kelas.peserta, peta.asesmen.map((a) => a.kode)),
    ambangKelulusanMhs: Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk),
  });

  const syarat = periksaPenutupan({
    butir: hasil.butir,
    temuan: (evaluasi?.temuan ?? []).map((t) => ({
      tingkat: t.tingkat,
      kode: t.kode,
      akarMasalah: t.akarMasalah,
      tindakan: t.tindakan,
      taSasaranId: t.taSasaranId,
    })),
    catatanProses: evaluasi?.catatanProses ?? null,
    pemblokirCapaian: hasil.pemblokir,
  });

  const snapshot =
    ditutup && evaluasi ? await ambilSnapshotEvaluasi(prisma, evaluasi.id, evaluasi.versi) : null;

  // Tindak lanjut semester lalu pada mata kuliah yang sama — inilah yang
  // menutup lingkaran: janji perbaikan ditagih di sini, bukan dilupakan.
  const temuanLama = await muatTemuanBelumDiverifikasi(rpkps.mataKuliah.id, kelasId);
  const verifikasi = nilaiVerifikasi(
    temuanLama.map((t) => ({
      tingkat: t.tingkat,
      kode: t.kode,
      capaianTerukur: t.capaianTerukur === null ? null : Number(t.capaianTerukur),
    })),
    hasil.butir,
  );

  // Analisis butir hanya jalan bila skor per butir memang direkam — lembar
  // butir pada templat nilai bersifat opsional (doc 05 §5.11).
  const analisis = rpkps.kisiKisi
    .map((k) => {
      const butir = k.butir.map((b) => ({
        nomor: b.nomor,
        subCpmkKode: b.subCpmk.kode,
        levelBloom: b.levelBloom,
        skorMaks: Number(b.skor),
      }));
      const nomorPerId = new Map(k.butir.map((b) => [b.id, b.nomor]));
      const peserta = kelas.peserta.map((p) => {
        const skor: Record<number, number | null> = {};
        for (const b of butir) skor[b.nomor] = null;
        for (const n of p.nilaiButir) {
          const nomor = nomorPerId.get(n.butirKisiKisiId);
          if (nomor !== undefined) skor[nomor] = Number(n.skor);
        }
        return { nim: p.mahasiswa.nim, skor };
      });
      return { jenis: k.jenis, hasil: analisisButir(butir, peserta, k.jenis) };
    })
    .filter((a) => a.hasil.ringkasan.jumlahPeserta > 0);

  const tahunAkademik = await prisma.tahunAkademik.findMany({
    orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
    take: 8,
    select: { id: true, kode: true },
  });

  const bolehKelola =
    rpkps.pengampu.some((p) => p.penggunaId === sesi.id) ||
    punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM");
  const terkunci = ditutup || !bolehKelola;

  const pengampu = rpkps.pengampu.map((p) => ({
    id: p.pengguna.id,
    nama: namaLengkapPengampu(p.pengguna),
  }));

  const temuanPer = new Map((evaluasi?.temuan ?? []).map((t) => [`${t.tingkat}|${t.kode}`, t]));
  const cpmkGagal = hasil.butir.filter((b) => b.tingkat === "CPMK" && !b.tercapai);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/kelas`}>
          <ArrowLeft />
          Kelas dan nilai
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rpkps.mataKuliah.kode}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluasi kelas {kelas.kode}</h1>
            <Badge variant={ditutup ? "default" : "outline"}>
              {ditutup ? `Ditutup · versi ${evaluasi?.versi}` : "Belum ditutup"}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {rpkps.mataKuliah.nama} · {kelas.rpkps.tahunAkademik.kode.replace("-", " ")} ·{" "}
            {kelas.dosen?.nama ?? "dosen belum ditentukan"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            variant="outline"
            href={`/api/rpkps/${id}/kelas/${kelasId}/portofolio`}
            prefetch={false}
          >
            <Download />
            Portofolio MK
          </ButtonLink>
          {bolehKelola ? <TombolPenutupan kelasId={kelasId} ditutup={ditutup} /> : null}
        </div>
      </header>

      {snapshot ? (
        <Card className="border-l-2 border-l-success bg-success/8">
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-foreground" />
              <div className="min-w-0">
                <CardTitle className="text-base">Hasil evaluasi terkunci</CardTitle>
                <CardDescription className="mt-1">
                  Sidik versi {snapshot.versi}:{" "}
                  <code className="rounded bg-muted px-1 font-mono">
                    {sidikRingkas(snapshot.sidik)}
                  </code>{" "}
                  — ditutup{" "}
                  {evaluasi?.ditutupPada?.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  oleh {evaluasi?.ditutupOleh?.nama ?? "—"}. Nilai boleh berubah setelah
                  remedial; salinan ini tidak.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <PanelSyarat syarat={syarat} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan kelas</CardTitle>
          <CardDescription>
            Ambang: mahasiswa lulus CPMK pada ≥{" "}
            {Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs)}, CPMK dinyatakan
            tercapai bila ≥{" "}
            {Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk)}% mahasiswa lulus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Angka label="Peserta" nilai={String(hasil.ringkasan.jumlahPeserta)} />
            <Angka label="Kelengkapan nilai" nilai={`${hasil.ringkasan.kelengkapan}%`} />
            <Angka
              label="CPMK tercapai"
              nilai={`${hasil.ringkasan.cpmkTercapai} / ${hasil.ringkasan.cpmkSeluruh}`}
            />
            <Angka
              label="CPL tercapai"
              nilai={`${hasil.ringkasan.cplTercapai} / ${hasil.ringkasan.cplSeluruh}`}
            />
          </dl>
        </CardContent>
      </Card>

      <TabelButir judul="Ketercapaian CPL" butir={hasil.butir.filter((b) => b.tingkat === "CPL")} />
      <TabelButir judul="Ketercapaian CPMK" butir={hasil.butir.filter((b) => b.tingkat === "CPMK")} />
      <TabelButir
        judul="Ketercapaian Sub-CPMK"
        butir={hasil.butir.filter((b) => b.tingkat === "SUB_CPMK")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catatan proses pembelajaran</CardTitle>
          <CardDescription>
            Bagian yang tidak dapat dihitung mesin — dan yang dibaca asesor lebih
            dulu. Wajib diisi sebelum evaluasi dapat ditutup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatatanProses
            kelasId={kelasId}
            awal={evaluasi?.catatanProses ?? ""}
            terkunci={terkunci}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tindak lanjut</CardTitle>
          <CardDescription>
            Setiap CPMK yang tidak tercapai wajib punya tindak lanjut sebelum
            evaluasi ditutup. Inilah yang membedakan evaluasi dari laporan nilai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {cpmkGagal.length === 0 && (evaluasi?.temuan.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Seluruh CPMK tercapai — tidak ada tindak lanjut yang diwajibkan.
            </p>
          ) : null}

          {cpmkGagal.map((b) => {
            const tersimpan = temuanPer.get(`CPMK|${b.kode}`);
            return (
              <div key={b.kode} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {b.kode}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {b.persenLulus ?? 0}% mahasiswa lulus · rerata {b.rerata ?? "—"} · {b.pita}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tersimpan ? (
                      <TombolTeruskan temuanId={tersimpan.id} sudah={tersimpan.usulanId !== null} />
                    ) : null}
                    {tersimpan && !terkunci ? (
                      <TombolHapusTemuan temuanId={tersimpan.id} />
                    ) : null}
                  </div>
                </div>

                {tersimpan?.usulan ? (
                  <p className="mb-3 text-sm">
                    Diteruskan menjadi{" "}
                    <Link
                      href={`/usulan/${tersimpan.usulan.id}`}
                      className="underline underline-offset-2"
                    >
                      usulan revisi kurikulum
                    </Link>{" "}
                    ({tersimpan.usulan.status.toLowerCase()}).
                  </p>
                ) : null}

                <FormulirTemuan
                  kelasId={kelasId}
                  tingkat="CPMK"
                  kode={b.kode}
                  awal={
                    tersimpan
                      ? {
                          akarMasalah: tersimpan.akarMasalah,
                          tindakan: tersimpan.tindakan,
                          penanggungJawabId: tersimpan.penanggungJawabId,
                          taSasaranId: tersimpan.taSasaranId,
                        }
                      : null
                  }
                  pengampu={pengampu}
                  tahunAkademik={tahunAkademik}
                  terkunci={terkunci}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {verifikasi.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verifikasi tindak lanjut semester lalu</CardTitle>
            <CardDescription>
              Janji perbaikan dari evaluasi sebelumnya ditagih di sini. Tanpa
              langkah ini, RTL hanya daftar niat yang tidak pernah diperiksa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifikasi.map((v, i) => {
              const asal = temuanLama[i];
              return (
                <div key={asal.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {v.kode}
                    </Badge>
                    <Badge variant={v.usulan === "TERCAPAI" ? "default" : "secondary"}>
                      usulan: {v.usulan.toLowerCase().replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      dari {asal.evaluasi.kelas.rpkps.tahunAkademik.kode.replace("-", " ")} kelas{" "}
                      {asal.evaluasi.kelas.kode}
                    </span>
                  </div>
                  <p className="mb-1 text-sm">{v.narasi}</p>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Tindakan yang dijanjikan: {asal.tindakan}
                  </p>
                  {bolehKelola ? <Verifikasi temuanId={asal.id} /> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {analisis.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analisis butir soal</CardTitle>
            <CardDescription>
              Daya beda menjawab yang tidak dapat dijawab nilai akhir: butir mana
              yang tidak memisahkan mahasiswa yang paham dari yang tidak.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {analisis.map(({ jenis, hasil: a }) => (
              <div key={jenis}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{jenis}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {a.ringkasan.jumlahPeserta} peserta berskor lengkap · kelompok atas
                    dan bawah {a.ringkasan.ukuranKelompok} orang
                    {a.reliabilitas !== null ? ` · Cronbach α ${a.reliabilitas}` : ""}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Butir</TableHead>
                        <TableHead>Sub-CPMK</TableHead>
                        <TableHead>Bloom</TableHead>
                        <TableHead className="text-right">Rerata</TableHead>
                        <TableHead className="text-right">P</TableHead>
                        <TableHead>Kesukaran</TableHead>
                        <TableHead className="text-right">D</TableHead>
                        <TableHead>Daya beda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.butir.map((b) => (
                        <TableRow key={b.nomor}>
                          <TableCell className="font-mono text-xs">{b.nomor}</TableCell>
                          <TableCell className="font-mono text-xs">{b.subCpmkKode}</TableCell>
                          <TableCell className="text-muted-foreground">{b.levelBloom}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {b.rerata} / {b.skorMaks}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{b.kesukaran}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {b.kategoriKesukaran}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{b.dayaBeda}</TableCell>
                          <TableCell
                            className={
                              b.kategoriDayaBeda === "BURUK"
                                ? "text-destructive"
                                : b.kategoriDayaBeda === "JELEK"
                                  ? "text-warning-foreground"
                                  : "text-muted-foreground"
                            }
                          >
                            {b.kategoriDayaBeda}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {a.temuan.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {a.temuan.map((t, i) => (
                      <li key={`${t.kode}-${i}`} className="flex items-start gap-2 text-sm">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {t.kode}
                          </span>
                          <p>{t.pesan}</p>
                          {t.saran ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">↳ {t.saran}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nilai per mahasiswa</CardTitle>
          <CardDescription>
            Capaian tiap CPMK dan nilai akhir, diturunkan dari skor mentah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIM</TableHead>
                  <TableHead>Nama</TableHead>
                  {rpkps.mataKuliah.cpmk.map((c) => (
                    <TableHead key={c.kode} className="text-right font-mono text-xs">
                      {c.kode}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Nilai akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hasil.mahasiswa.map((m) => (
                  <TableRow key={m.nim}>
                    <TableCell className="font-mono text-xs">{m.nim}</TableCell>
                    <TableCell>{m.nama}</TableCell>
                    {rpkps.mataKuliah.cpmk.map((c) => {
                      const n = m.cpmk[c.kode];
                      return (
                        <TableCell
                          key={c.kode}
                          className={`text-right tabular-nums ${
                            n === null || n === undefined
                              ? "text-muted-foreground"
                              : n < Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs)
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {n ?? "·"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-medium tabular-nums">
                      {m.nilaiAkhir ?? "·"}
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

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{nilai}</dd>
    </div>
  );
}

function TabelButir({ judul, butir }: { judul: string; butir: CapaianButir[] }) {
  if (butir.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{judul}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{LABEL_TINGKAT[butir[0].tingkat]}</TableHead>
                <TableHead className="text-right">Rerata</TableHead>
                <TableHead className="text-right">Mahasiswa lulus</TableHead>
                <TableHead>Pita</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {butir.map((b) => (
                <TableRow key={b.kode}>
                  <TableCell className="font-mono text-xs">{b.kode}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.rerata ?? "·"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.persenLulus === null ? "·" : `${b.persenLulus}%`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.pita}</TableCell>
                  <TableCell>
                    {b.jumlahDinilai === 0 ? (
                      <span className="text-muted-foreground">belum terukur</span>
                    ) : b.tercapai ? (
                      <span className="text-success-foreground">tercapai</span>
                    ) : (
                      <span className="text-destructive">belum tercapai</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PanelSyarat({
  syarat,
}: {
  syarat: { temuan: TemuanRpkps[]; pemblokir: TemuanRpkps[]; dapatDitutup: boolean };
}) {
  const peringatan = syarat.temuan.filter((t) => t.tingkat === "PERINGATAN");

  return (
    <Card
      className={
        syarat.dapatDitutup
          ? "border-l-2 border-l-success bg-success/8"
          : "border-l-2 border-l-destructive bg-destructive/8"
      }
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {syarat.dapatDitutup ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" />
          ) : (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              {syarat.dapatDitutup
                ? "Siap ditutup"
                : `${syarat.pemblokir.length} syarat belum terpenuhi`}
            </CardTitle>
            <CardDescription className="mt-1">
              Menutup evaluasi membekukan hasilnya beserta sidik SHA-256 tersendiri.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {syarat.temuan.length > 0 ? (
        <CardContent>
          <ul className="space-y-2">
            {[...syarat.pemblokir, ...peringatan].map((t, i) => (
              <li key={`${t.kode}-${i}`} className="flex items-start gap-2.5 text-sm">
                {t.tingkat === "PEMBLOKIR" ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                )}
                <div className="min-w-0">
                  <span className="font-mono text-[10px] text-muted-foreground">{t.kode}</span>
                  <p>{t.pesan}</p>
                  {t.saran ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">↳ {t.saran}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
