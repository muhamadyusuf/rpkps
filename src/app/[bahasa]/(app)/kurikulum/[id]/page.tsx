import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi, pilihTeks } from "@/lib/bahasa/teks";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, UserRoundCog } from "lucide-react";
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
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { bolehSuntingKurikulum } from "@/domain/kurikulum/sunting";
import { muatKurikulumInput } from "@/lib/kurikulum/usulan";
import { validasiKurikulum } from "@/domain/kurikulum/validator";
import { TombolHapusKurikulum, TombolStatusKurikulum } from "../tombol";
import { PengelolaProfilLulusan } from "./profil-lulusan";
import { PengelolaCpl } from "./cpl";
import { PengelolaMataKuliah } from "./mata-kuliah";
import { PetaSemester } from "@/components/peta-semester";
import { bacaTampilan, PengalihTampilan } from "@/components/pengalih-tampilan";
import { PanelValidator } from "./validator";

export const dynamic = "force-dynamic";

export default async function HalamanDetailKurikulum({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;
  const tampilan = bacaTampilan((await searchParams).tampilan);

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    include: {
      prodi: {
        select: {
          id: true,
          nama: true,
          kode: true,
          // Kop lembar peta menyebut tiga tingkat unit, sama seperti lembar
          // struktur kurikulum yang dicetak prodi.
          fakultas: { select: { nama: true, institusi: { select: { nama: true } } } },
        },
      },
      profilLulusan: {
        orderBy: { urutan: "asc" },
        include: { cpl: { select: { cplId: true } } },
      },
      cpl: {
        orderBy: { urutan: "asc" },
        include: {
          _count: { select: { mataKuliah: true, cpmk: true } },
          profilLulusan: {
            include: { profilLulusan: { select: { kode: true } } },
          },
        },
      },
      mataKuliah: {
        orderBy: [{ semester: "asc" }, { kode: "asc" }],
        include: {
          cpl: { include: { cpl: { select: { kode: true } } } },
          _count: { select: { cpmk: true } },
        },
      },
      daftarRevisi: {
        orderBy: { revisiKe: "desc" },
        include: {
          oleh: { select: { nama: true } },
          berlakuMulaiTa: { select: { kode: true } },
          usulan: { select: { id: true, judul: true } },
        },
      },
    },
  });

  if (!kurikulum) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) notFound();

  const bolehKelola = punyaPeran(sesi, "ADMIN", "KAPRODI");

  /*
   * G1 (docs/15 §2.2). Halaman memutuskan apa yang DIRENDER; aksinya memeriksa
   * ulang di server. Keduanya perlu — yang di sini supaya tombolnya tidak
   * menipu, yang di sana karena server action adalah titik masuk yang dapat
   * dipanggil tanpa melewati antarmuka sama sekali.
   */
  const gerbang = bolehSuntingKurikulum(kurikulum.status);
  const bolehSunting = bolehKelola && gerbang.boleh;

  /*
   * Pemeriksaan yang sama dengan jalur impor, dijalankan hidup pada kurikulum
   * yang disusun tangan (docs/15 §2.6). Tanpa ini, kurikulum tulisan tangan
   * lolos dari mutu yang ditegakkan pada berkas Excel.
   */
  const masukanValidator = bolehSunting ? await muatKurikulumInput(kurikulum.id) : null;
  const validasi = masukanValidator ? validasiKurikulum(masukanValidator) : null;

  // CPL yang tidak dibebankan pada mata kuliah mana pun tidak akan pernah
  // tercapai — ditandai di sini agar terlihat sebelum RPKPS disusun.
  const cplYatim = kurikulum.cpl.filter((c) => c._count.mataKuliah === 0);

  // Profil yang tidak ditopang CPL mana pun adalah janji yang tidak dibayar
  // kurikulum — kelas kesalahan yang sama dengan cplYatim di atas, satu lapis
  // lebih ke hulu.
  const profilYatim = kurikulum.profilLulusan.filter((p) => p.cpl.length === 0);

  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/kurikulum">
          <ArrowLeft />
          {k.kurikulum.detail.kembali}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{kurikulum.nama}</h1>
            <Badge variant={kurikulum.status === "BERLAKU" ? "default" : "outline"}>
              {k.enum.statusKurikulum[kurikulum.status]}
            </Badge>
            {kurikulum.revisi > 0 ? (
              <Badge variant="secondary">
                {isi(k.kurikulum.detail.revisiKe, { nomor: kurikulum.revisi })}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isi(k.kurikulum.detail.ringkasan, {
              prodi: kurikulum.prodi.nama,
              kode: kurikulum.prodi.kode,
              tahun: kurikulum.tahun,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/*
            Terbuka juga bagi yang hanya boleh membaca: "siapa yang pegang MK
            ini?" adalah pertanyaan seluruh prodi, bukan hanya yang membaginya.
          */}
          <ButtonLink variant="outline" size="sm" href={`/kurikulum/${kurikulum.id}/koordinator`}>
            <UserRoundCog />
            {k.kurikulum.detail.koordinatorMk}
          </ButtonLink>
          {bolehKelola ? (
            <>
              <TombolStatusKurikulum id={kurikulum.id} status={kurikulum.status} />
              {kurikulum.status !== "BERLAKU" ? (
                <TombolHapusKurikulum id={kurikulum.id} nama={kurikulum.nama} />
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {bolehKelola && !gerbang.boleh ? (
        <div className="flex flex-wrap items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{k.kurikulum.sunting.terkunciJudul}</p>
            <p className="mt-0.5 text-muted-foreground">
              {kurikulum.status === "BERLAKU"
                ? k.kurikulum.sunting.terkunciBerlaku
                : k.kurikulum.sunting.terkunciArsip}
            </p>
          </div>
          {kurikulum.status === "BERLAKU" ? (
            <ButtonLink size="sm" variant="outline" href="/usulan/baru">
              {k.kurikulum.mk.usulkanRevisi}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {validasi ? <PanelValidator hasil={validasi} /> : null}

      {cplYatim.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.kurikulum.detail.cplYatimJudul, { jumlah: cplYatim.length })}
            </CardTitle>
            <CardDescription className="mt-1">
              {isi(k.kurikulum.detail.cplYatimIsi, {
                kode: cplYatim.map((c) => c.kode).join(", "),
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {profilYatim.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.kurikulum.detail.profilYatimJudul, { jumlah: profilYatim.length })}
            </CardTitle>
            <CardDescription className="mt-1">
              {isi(k.kurikulum.detail.profilYatimIsi, {
                kode: profilYatim.map((p) => p.kode).join(", "),
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {kurikulum.daftarRevisi.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.kurikulum.detail.riwayatJudul, {
                jumlah: kurikulum.daftarRevisi.length,
              })}
            </CardTitle>
            <CardDescription>{k.kurikulum.detail.riwayatKeterangan}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {kurikulum.daftarRevisi.map((r) => (
              <div key={r.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {isi(k.kurikulum.detail.revisiKe, { nomor: r.revisiKe })}
                  </Badge>
                  {r.berlakuMulaiTa ? (
                    <Badge variant="outline" className="text-[10px]">
                      {isi(k.kurikulum.detail.berlakuTa, { ta: r.berlakuMulaiTa.kode })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {k.kurikulum.detail.ralatSegera}
                    </Badge>
                  )}
                  {r.disahkanSendiri ? (
                    <Badge variant="outline" className="text-[10px]">
                      {k.kurikulum.detail.disahkanSendiri}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5">
                  <Tautan href={`/usulan/${r.usulan.id}`} className="hover:underline">
                    {r.usulan.judul}
                  </Tautan>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.ringkasan}
                  {r.oleh
                    ? isi(k.kurikulum.detail.disahkanOleh, { nama: r.oleh.nama })
                    : ""}{" "}
                  · {tanggal(r.dibuatPada, b, "pendek")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isi(k.kurikulum.detail.profilJudul, {
              jumlah: kurikulum.profilLulusan.length,
            })}
          </CardTitle>
          <CardDescription>{k.kurikulum.detail.profilKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          {bolehKelola ? (
            <PengelolaProfilLulusan
              kurikulumId={kurikulum.id}
              profil={kurikulum.profilLulusan.map((p) => ({
                id: p.id,
                kode: p.kode,
                deskripsi: p.deskripsi,
                deskripsiEn: p.deskripsiEn,
                cplId: p.cpl.map((x) => x.cplId),
              }))}
              cpl={kurikulum.cpl.map((c) => ({
                id: c.id,
                kode: c.kode,
                deskripsi: c.deskripsi,
                deskripsiEn: c.deskripsiEn,
              }))}
            />
          ) : (
            <div className="space-y-3">
              {kurikulum.profilLulusan.map((p) => {
                const kodeCpl = kurikulum.cpl
                  .filter((c) => p.cpl.some((x) => x.cplId === c.id))
                  .map((c) => c.kode);
                return (
                  <div key={p.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{p.kode}</Badge>
                      {kodeCpl.map((kode) => (
                        <Badge key={kode} variant="outline" className="text-[10px]">
                          {kode}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-sm">
                      {pilihTeks(p.deskripsi, p.deskripsiEn, b).teks}
                    </p>
                  </div>
                );
              })}
              {kurikulum.profilLulusan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {k.kurikulum.detail.profilKosong}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isi(k.kurikulum.detail.cplJudul, { jumlah: kurikulum.cpl.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bolehSunting ? (
            <PengelolaCpl
              kurikulumId={kurikulum.id}
              daftar={kurikulum.cpl.map((c) => ({
                id: c.id,
                kode: c.kode,
                deskripsi: c.deskripsi,
                deskripsiEn: c.deskripsiEn,
                ranah: c.ranah,
                tingkatKkni: c.tingkatKkni,
                jumlahMk: c._count.mataKuliah,
                jumlahCpmk: c._count.cpmk,
                kodeProfil: c.profilLulusan.map((m) => m.profilLulusan.kode),
              }))}
            />
          ) : null}
          {!bolehSunting &&
            kurikulum.cpl.map((c) => (
            <div key={c.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{c.kode}</Badge>
                {c.tingkatKkni ? (
                  <span className="text-xs text-muted-foreground">
                    {isi(k.kurikulum.detail.kkni, { tingkat: c.tingkatKkni })}
                  </span>
                ) : null}
                {c.profilLulusan.map((m) => (
                  <Badge
                    key={m.profilLulusanId}
                    variant="outline"
                    className="text-[10px]"
                  >
                    {m.profilLulusan.kode}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  {isi(k.kurikulum.detail.cplRingkas, {
                    mk: c._count.mataKuliah,
                    cpmk: c._count.cpmk,
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm">
                {pilihTeks(c.deskripsi, c.deskripsiEn, b).teks}
              </p>
            </div>
          ))}
          {!bolehSunting && kurikulum.cpl.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.kurikulum.detail.cplKosong}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {isi(k.kurikulum.detail.mkJudul, { jumlah: kurikulum.mataKuliah.length })}
              </CardTitle>
              <CardDescription className="mt-1">
                {k.kurikulum.detail.mkKeterangan}
              </CardDescription>
            </div>
            {/*
              Peta lebih dulu, tabel sebagai lapis kedua: struktur kurikulum
              dibaca per semester, sedangkan kolom CPL, CPMK, dan tombol sunting
              baru dicari setelah mata kuliahnya ketemu.
            */}
            <PengalihTampilan
              basis={`/kurikulum/${kurikulum.id}`}
              tampilan={tampilan}
            />
          </div>
        </CardHeader>
        <CardContent>
          {tampilan === "peta" ? (
            <PetaSemester
              kop={{
                judul: isi(k.kurikulum.detail.kopJudul, {
                  tahun: kurikulum.tahun,
                  prodi: kurikulum.prodi.nama,
                }),
                baris: [
                  kurikulum.prodi.fakultas.nama,
                  kurikulum.prodi.fakultas.institusi.nama,
                ],
              }}
              kosong={k.kurikulum.detail.mkKosong}
              baris={kurikulum.mataKuliah.map((mk) => ({
                id: mk.id,
                kode: mk.kode,
                nama: pilihTeks(mk.nama, mk.namaEn, b).teks,
                semester: mk.semester,
                sksTeori: mk.sksTeori,
                sksPraktik: mk.sksPraktik,
                href: `/kurikulum/${kurikulum.id}/mk/${mk.id}`,
                lencana:
                  mk.status === "WAJIB" ? null : (
                    <Badge variant="outline" className="text-[10px]">
                      {k.enum.statusMataKuliah[mk.status]}
                    </Badge>
                  ),
              }))}
            />
          ) : bolehSunting ? (
            <PengelolaMataKuliah
              kurikulumId={kurikulum.id}
              daftar={kurikulum.mataKuliah.map((mk) => ({
                id: mk.id,
                kode: mk.kode,
                nama: mk.nama,
                namaEn: mk.namaEn,
                deskripsiEn: mk.deskripsiEn,
                deskripsi: mk.deskripsi,
                semester: mk.semester,
                status: mk.status,
                sksTeori: mk.sksTeori,
                sksPraktik: mk.sksPraktik,
                bentukTeori: mk.bentukTeori,
                bentukPraktik: mk.bentukPraktik,
                kodeCpl: mk.cpl.map((m) => m.cpl.kode),
                jumlahCpmk: mk._count.cpmk,
              }))}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{k.kurikulum.detail.kolomKode}</TableHead>
                    <TableHead>{k.kurikulum.detail.kolomNama}</TableHead>
                    <TableHead className="text-center">{k.kurikulum.detail.kolomSmt}</TableHead>
                    <TableHead className="text-center">{k.kurikulum.detail.kolomSks}</TableHead>
                    <TableHead>{k.kurikulum.detail.kolomCpl}</TableHead>
                    <TableHead className="text-right">{k.kurikulum.detail.kolomCpmk}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kurikulum.mataKuliah.map((mk) => (
                    <TableRow key={mk.id}>
                      <TableCell>
                        <Tautan
                          href={`/kurikulum/${kurikulum.id}/mk/${mk.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {mk.kode}
                        </Tautan>
                      </TableCell>
                      <TableCell className="text-sm">
                        {pilihTeks(mk.nama, mk.namaEn, b).teks}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {mk.semester}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {mk.sksTeori + mk.sksPraktik}
                        <span className="text-muted-foreground">
                          {" "}
                          ({mk.sksTeori}+{mk.sksPraktik})
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {mk.cpl.map((m) => (
                            <Badge key={m.cplId} variant="outline" className="text-[10px]">
                              {m.cpl.kode}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {mk._count.cpmk}
                      </TableCell>
                    </TableRow>
                  ))}
                  {kurikulum.mataKuliah.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        {k.kurikulum.detail.mkKosong}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
