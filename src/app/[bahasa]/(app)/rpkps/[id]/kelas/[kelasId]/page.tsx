import { notFound } from "next/navigation";
import { Tautan } from "@/components/tautan";
import { ArrowLeft, CheckCircle2, CircleAlert, Download, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi, namaMk } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
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
import { teksTemuan } from "@/lib/bahasa/temuan";
import {
  CatatanProses,
  FormulirTemuan,
  TombolHapusTemuan,
  TombolPenutupan,
  TombolTeruskan,
  Verifikasi,
} from "./pengelola";

export const dynamic = "force-dynamic";

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

  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/kelas`}>
          <ArrowLeft />
          {k.rpkps.evaluasiKelas.kembali}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rpkps.mataKuliah.kode}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isi(k.rpkps.evaluasiKelas.judul, { kode: kelas.kode })}
            </h1>
            <Badge variant={ditutup ? "default" : "outline"}>
              {ditutup
                ? isi(k.rpkps.evaluasiKelas.ditutup, { versi: evaluasi?.versi ?? "" })
                : k.rpkps.evaluasiKelas.belumDitutup}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isi(k.rpkps.evaluasiKelas.ringkasHeader, {
              mk: namaMk(rpkps.mataKuliah, b),
              ta: kelas.rpkps.tahunAkademik.kode.replace("-", " "),
              dosen: kelas.dosen?.nama ?? k.rpkps.evaluasiKelas.dosenKosong,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            variant="outline"
            href={`/api/rpkps/${id}/kelas/${kelasId}/portofolio`}
            prefetch={false}
          >
            <Download />
            {k.rpkps.evaluasiKelas.portofolio}
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
                <CardTitle className="text-base">{k.rpkps.evaluasiKelas.terkunciJudul}</CardTitle>
                <CardDescription className="mt-1">
                  {isi(k.rpkps.evaluasiKelas.sidikVersi, { versi: snapshot.versi })}{" "}
                  <code className="rounded bg-muted px-1 font-mono">
                    {sidikRingkas(snapshot.sidik)}
                  </code>{" "}
                  {isi(k.rpkps.evaluasiKelas.ditutupPada, {
                    tanggal: evaluasi?.ditutupPada
                      ? tanggal(evaluasi.ditutupPada, b, "panjang")
                      : "—",
                    oleh: evaluasi?.ditutupOleh?.nama ?? "—",
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <PanelSyarat syarat={syarat} k={k} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {k.rpkps.evaluasiKelas.ringkasanJudul}
          </CardTitle>
          <CardDescription>
            {isi(k.rpkps.evaluasiKelas.ambang, {
              mhs: Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs),
              mk: Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Angka
              label={k.rpkps.evaluasiKelas.peserta}
              nilai={String(hasil.ringkasan.jumlahPeserta)}
            />
            <Angka
              label={k.rpkps.evaluasiKelas.kelengkapan}
              nilai={`${hasil.ringkasan.kelengkapan}%`}
            />
            <Angka
              label={k.rpkps.evaluasiKelas.cpmkTercapai}
              nilai={`${hasil.ringkasan.cpmkTercapai} / ${hasil.ringkasan.cpmkSeluruh}`}
            />
            <Angka
              label={k.rpkps.evaluasiKelas.cplTercapai}
              nilai={`${hasil.ringkasan.cplTercapai} / ${hasil.ringkasan.cplSeluruh}`}
            />
          </dl>
        </CardContent>
      </Card>

      <TabelButir
        judul={k.rpkps.evaluasiKelas.ketercapaianCpl}
        butir={hasil.butir.filter((x) => x.tingkat === "CPL")}
        k={k}
      />
      <TabelButir
        judul={k.rpkps.evaluasiKelas.ketercapaianCpmk}
        butir={hasil.butir.filter((x) => x.tingkat === "CPMK")}
        k={k}
      />
      <TabelButir
        judul={k.rpkps.evaluasiKelas.ketercapaianSub}
        butir={hasil.butir.filter((x) => x.tingkat === "SUB_CPMK")}
        k={k}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.evaluasiKelas.catatanProsesJudul}</CardTitle>
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
          <CardTitle className="text-base">
            {k.rpkps.evaluasiKelas.tindakLanjutJudul}
          </CardTitle>
          <CardDescription>
            {k.rpkps.evaluasiKelas.tindakLanjutKeterangan}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {cpmkGagal.length === 0 && (evaluasi?.temuan.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              {k.rpkps.evaluasiKelas.semuaTercapai}
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
                      {isi(k.rpkps.evaluasiKelas.butirRingkas, {
                        persen: b.persenLulus ?? 0,
                        rerata: b.rerata ?? "—",
                        pita: b.pita,
                      })}
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
                    <Tautan
                      href={`/usulan/${tersimpan.usulan.id}`}
                      className="underline underline-offset-2"
                    >
                      usulan revisi kurikulum
                    </Tautan>{" "}
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
            <CardTitle className="text-base">
              {k.rpkps.evaluasiKelas.verifikasiJudul}
            </CardTitle>
            <CardDescription>
              {k.rpkps.evaluasiKelas.verifikasiKeterangan}
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
                      {isi(k.rpkps.evaluasiKelas.usulanLabel, {
                        status: v.usulan.toLowerCase().replace("_", " "),
                      })}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {isi(k.rpkps.evaluasiKelas.asalTemuan, {
                        ta: asal.evaluasi.kelas.rpkps.tahunAkademik.kode.replace("-", " "),
                        kelas: asal.evaluasi.kelas.kode,
                      })}
                    </span>
                  </div>
                  <p className="mb-1 text-sm">{v.narasi}</p>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {isi(k.rpkps.evaluasiKelas.tindakanDijanjikan, {
                      tindakan: asal.tindakan,
                    })}
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
            <CardTitle className="text-base">{k.rpkps.evaluasiKelas.analisisJudul}</CardTitle>
            <CardDescription>{k.rpkps.evaluasiKelas.analisisKeterangan}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {analisis.map(({ jenis, hasil: a }) => (
              <div key={jenis}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{jenis}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {isi(k.rpkps.evaluasiKelas.analisisRingkas, {
                      peserta: a.ringkasan.jumlahPeserta,
                      kelompok: a.ringkasan.ukuranKelompok,
                    })}
                    {a.reliabilitas !== null
                      ? isi(k.rpkps.evaluasiKelas.reliabilitas, {
                          nilai: a.reliabilitas,
                        })
                      : ""}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{k.rpkps.evaluasiKelas.kolomButir}</TableHead>
                        <TableHead>Sub-CPMK</TableHead>
                        <TableHead>{k.rpkps.evaluasiKelas.kolomBloom}</TableHead>
                        <TableHead className="text-right">
                          {k.rpkps.evaluasiKelas.kolomRerata}
                        </TableHead>
                        <TableHead className="text-right">P</TableHead>
                        <TableHead>{k.rpkps.evaluasiKelas.kolomKesukaran}</TableHead>
                        <TableHead className="text-right">D</TableHead>
                        <TableHead>{k.rpkps.evaluasiKelas.kolomDayaBeda}</TableHead>
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
                          <p>{teksTemuan(t, k).pesan}</p>
                          {teksTemuan(t, k).saran ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">↳ {teksTemuan(t, k).saran}</p>
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
          <CardTitle className="text-base">{k.rpkps.evaluasiKelas.nilaiJudul}</CardTitle>
          <CardDescription>{k.rpkps.evaluasiKelas.nilaiKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{k.rpkps.evaluasiKelas.kolomNim}</TableHead>
                  <TableHead>{k.rpkps.evaluasiKelas.kolomNama}</TableHead>
                  {rpkps.mataKuliah.cpmk.map((c) => (
                    <TableHead key={c.kode} className="text-right font-mono text-xs">
                      {c.kode}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">
                    {k.rpkps.evaluasiKelas.kolomNilaiAkhir}
                  </TableHead>
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

function TabelButir({
  judul,
  butir,
  k,
}: {
  judul: string;
  butir: CapaianButir[];
  k: Kamus;
}) {
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
                <TableHead>{k.enum.tingkatCapaian[butir[0].tingkat]}</TableHead>
                <TableHead className="text-right">
                  {k.rpkps.evaluasiKelas.kolomRerata}
                </TableHead>
                <TableHead className="text-right">
                  {k.rpkps.evaluasiKelas.kolomMahasiswaLulus}
                </TableHead>
                <TableHead>{k.rpkps.evaluasiKelas.kolomPita}</TableHead>
                <TableHead>{k.rpkps.evaluasiKelas.kolomStatus}</TableHead>
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
                      <span className="text-muted-foreground">
                        {k.rpkps.evaluasiKelas.belumTerukur}
                      </span>
                    ) : b.tercapai ? (
                      <span className="text-success-foreground">
                        {k.rpkps.evaluasiKelas.tercapai}
                      </span>
                    ) : (
                      <span className="text-destructive">
                        {k.rpkps.evaluasiKelas.belumTercapai}
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
  );
}

function PanelSyarat({
  syarat,
  k,
}: {
  syarat: { temuan: TemuanRpkps[]; pemblokir: TemuanRpkps[]; dapatDitutup: boolean };
  k: Kamus;
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
                ? k.rpkps.evaluasiKelas.siapDitutup
                : isi(k.rpkps.evaluasiKelas.syaratBelum, {
                    jumlah: syarat.pemblokir.length,
                  })}
            </CardTitle>
            <CardDescription className="mt-1">
              {k.rpkps.evaluasiKelas.syaratKeterangan}
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
                  <p>{teksTemuan(t, k).pesan}</p>
                  {teksTemuan(t, k).saran ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">↳ {teksTemuan(t, k).saran}</p>
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
