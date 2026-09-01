import { notFound } from "next/navigation";
import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import { ArrowLeft, CircleCheckBig, Lock, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import {
  dampakUsulan,
  keUsulanInput,
  muatKurikulumInput,
  muatUsulan,
  taBerlakuBawaan,
} from "@/lib/kurikulum/usulan";
import {
  periksaPenerapan,
  periksaUsulanRevisi,
  type TemuanUsulan,
} from "@/domain/kurikulum/usulan";
import {
  JENIS_BERUMUSAN,

  VARIAN_STATUS,
} from "../label";
import { FormulirButir, TombolHapusButir } from "./butir";
import { Diskusi } from "./diskusi";
import { KeputusanButir, TindakanPemutus, TindakanPengusul } from "./keputusan";
import { teksTemuan } from "@/lib/bahasa/temuan";

export const dynamic = "force-dynamic";

export default async function HalamanUsulan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  const usulan = await muatUsulan(id);
  if (!usulan) notFound();

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(usulan.kurikulum.prodiId)) notFound();

  const [kurikulum, dampak, taBawaan, daftarTa] = await Promise.all([
    muatKurikulumInput(usulan.kurikulumId),
    dampakUsulan(usulan),
    taBerlakuBawaan(),
    prisma.tahunAkademik.findMany({
      orderBy: [{ tahunMulai: "desc" }, { semester: "asc" }],
      select: { id: true, kode: true },
      take: 12,
    }),
  ]);
  if (!kurikulum) notFound();

  const masukan = keUsulanInput(usulan);
  const sedangDiputuskan = usulan.status === "DIAJUKAN";
  const hasil = sedangDiputuskan
    ? periksaPenerapan(kurikulum, masukan)
    : periksaUsulanRevisi(kurikulum, masukan);

  const bolehMemutus = punyaPeranDiProdi(sesi, usulan.kurikulum.prodiId, "ADMIN", "KAPRODI");
  const adalahPengusul = usulan.diajukanOlehId === sesi.id;
  const dapatDisunting = usulan.status === "DRAF" || usulan.status === "DIREVISI";

  const mk = kurikulum.mataKuliah.find((m) => m.kode === usulan.mataKuliah.kode);
  const temuanButir = (butirId: string) => hasil.temuan.filter((t) => t.butirId === butirId);
  const temuanUmum = hasil.temuan.filter((t) => !t.butirId);

  /** Rumusan yang berlaku sekarang, untuk perbandingan berdampingan. */
  function rumusanSekarang(b: { cpmkKode: string; subCpmkKode: string | null }): string | null {
    const cpmk = mk?.cpmk.find((c) => c.kode === b.cpmkKode);
    if (!cpmk) return null;
    if (b.subCpmkKode) {
      return cpmk.subCpmk.find((s) => s.kode === b.subCpmkKode)?.rumusan ?? null;
    }
    return cpmk.rumusan;
  }

  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/usulan">
          <ArrowLeft />
          {k.usulan.detail.kembali}
        </ButtonLink>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={VARIAN_STATUS[usulan.status]}>
            {k.enum.statusUsulan[usulan.status]}
          </Badge>
          <Tautan
            href={`/kurikulum/${usulan.kurikulumId}/mk/${usulan.mataKuliahId}`}
            className="inline-flex"
          >
            <Badge variant="outline">{usulan.mataKuliah.kode}</Badge>
          </Tautan>
          {usulan.jalurRalat ? (
            <Badge variant="secondary">{k.usulan.detail.ralatSegera}</Badge>
          ) : null}
          {usulan.revisi ? (
            <Badge variant="secondary">
              {isi(k.usulan.revisiKe, { nomor: usulan.revisi.revisiKe })}
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{usulan.judul}</h1>
        <p className="text-sm text-muted-foreground">
          {isi(k.usulan.detail.ringkasan, {
            mk: namaMk(usulan.mataKuliah, b),
            kurikulum: usulan.kurikulum.nama,
            tahun: usulan.kurikulum.tahun,
            oleh: usulan.diajukanOleh.nama,
          })}
          {usulan.berlakuMulaiTa
            ? isi(k.usulan.detail.berlakuMulai, { ta: usulan.berlakuMulaiTa.kode })
            : ""}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.usulan.detail.latar}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{usulan.latar}</p>
        </CardContent>
      </Card>

      {usulan.catatanPemutus ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">
              {isi(k.usulan.detail.catatanPemutus, {
                nama: usulan.diputuskanOleh?.nama ?? k.usulan.detail.kaprodiBaku,
              })}
            </p>
            <p className="mt-0.5 text-muted-foreground">{usulan.catatanPemutus}</p>
          </div>
        </div>
      ) : null}

      {usulan.revisi?.disahkanSendiri ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            {k.usulan.detail.disahkanSendiri}
          </p>
        </div>
      ) : null}

      <PanelTemuan temuan={temuanUmum} lolos={hasil.lolos} k={k} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {isi(k.usulan.detail.butirJudul, { jumlah: usulan.butir.length })}
        </h2>

        {usulan.butir.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {k.usulan.detail.butirKosong}
            </CardContent>
          </Card>
        ) : null}

        {usulan.butir.map((b) => {
          const temuan = temuanButir(b.id);
          const sekarang = rumusanSekarang(b);
          const berumusan = JENIS_BERUMUSAN.includes(b.jenis);

          return (
            <Card key={b.id} data-status={b.status}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{k.enum.jenisButir[b.jenis]}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {b.subCpmkKode ?? b.cpmkKode}
                  </Badge>
                  {b.levelBloom ? (
                    <Badge variant="outline" className="text-[10px]">
                      {b.levelBloom}
                    </Badge>
                  ) : null}
                  {b.sumber === "AI" ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Sparkles className="size-2.5" />
                      {k.usulan.detail.drafAi}
                    </Badge>
                  ) : null}
                  {b.status !== "BARU" ? (
                    <Badge variant={b.status === "DITOLAK" ? "destructive" : "secondary"}>
                      {k.enum.statusButir[b.status]}
                    </Badge>
                  ) : null}
                  {dapatDisunting && (adalahPengusul || bolehMemutus) ? (
                    <TombolHapusButir butirId={b.id} />
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {berumusan ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="panel rounded-lg border p-3">
                      <p className="label-teknis text-muted-foreground/80">
                        {k.usulan.detail.sekarang}
                      </p>
                      <p className="mt-1.5 text-sm">
                        {sekarang ?? (
                          <span className="text-muted-foreground">
                            {k.usulan.detail.belumAda}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="panel rounded-lg border border-ring/40 p-3">
                      <p className="label-teknis text-muted-foreground/80">
                        {k.usulan.detail.usulanKolom}
                      </p>
                      <p className="mt-1.5 text-sm">{b.rumusan}</p>
                    </div>
                  </div>
                ) : null}

                {b.cplKode.length > 0 ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{k.usulan.detail.petaCpl}</span>
                    {b.cplKode.join(", ")}
                  </p>
                ) : null}
                {b.mingguDisarankan.length > 0 ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {k.usulan.detail.mingguDisarankan}
                    </span>
                    {b.mingguDisarankan.join(", ")}
                  </p>
                ) : null}

                <div>
                  <p className="label-teknis text-muted-foreground/80">{k.usulan.detail.alasan}</p>
                  <p className="mt-1 text-sm">{b.alasan}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="label-teknis text-muted-foreground/80">{k.usulan.detail.dasar}</p>
                  {b.dasar.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge variant="secondary" className="text-[10px]">
                        {k.enum.jenisDasar[d.jenis]}
                      </Badge>
                      {d.ref ? (
                        <span className="font-mono text-xs text-muted-foreground">{d.ref}</span>
                      ) : null}
                      <span className="min-w-0 flex-1">{d.kutipan}</span>
                    </div>
                  ))}
                </div>

                {b.catatanPemutus ? (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="label-teknis text-muted-foreground/80">
                      {k.usulan.detail.catatanKaprodi}
                    </p>
                    <p className="mt-1">{b.catatanPemutus}</p>
                  </div>
                ) : null}

                {temuan.length > 0 ? <DaftarTemuan temuan={temuan}  k={k}/> : null}

                {sedangDiputuskan && bolehMemutus ? (
                  <KeputusanButir
                    butirId={b.id}
                    status={b.status}
                    rumusan={b.rumusan}
                    dapatDisunting={berumusan}
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {dapatDisunting && (adalahPengusul || bolehMemutus) ? (
          <FormulirButir usulanId={usulan.id} mkKode={usulan.mataKuliah.kode} />
        ) : null}
      </section>

      {sedangDiputuskan && bolehMemutus ? (
        <PanelDampak dampak={dampak} jalurRalat={usulan.jalurRalat} k={k} />
      ) : null}

      <Diskusi usulanId={usulan.id} catatan={usulan.catatan} />

      <div className="flex flex-wrap gap-2">
        {dapatDisunting && (adalahPengusul || bolehMemutus) ? (
          <TindakanPengusul
            usulanId={usulan.id}
            adalahPengusul={adalahPengusul}
            status={usulan.status}
          />
        ) : null}
        {sedangDiputuskan && bolehMemutus ? (
          <TindakanPemutus
            usulanId={usulan.id}
            jalurRalat={usulan.jalurRalat}
            taBawaan={taBawaan}
            daftarTa={daftarTa}
            adaButirBelumDiputuskan={usulan.butir.some((b) => b.status === "BARU")}
          />
        ) : null}
        {sedangDiputuskan && !bolehMemutus && adalahPengusul ? (
          <TindakanPengusul usulanId={usulan.id} adalahPengusul status={usulan.status} />
        ) : null}
      </div>
    </div>
  );
}

function PanelTemuan({
  temuan,
  lolos,
  k,
}: {
  temuan: TemuanUsulan[];
  lolos: boolean;
  k: Kamus;
}) {
  if (lolos && temuan.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-muted-foreground">
          {k.usulan.detail.tanpaTemuan}
        </p>
      </div>
    );
  }
  if (temuan.length === 0) return null;
  return <DaftarTemuan temuan={temuan}  k={k}/>;
}

/**
 * Hanya temuan yang DIBAWA usulan ini yang tampil — temuan warisan kurikulum
 * disaring di domain, supaya Kaprodi tidak dihujani kesalahan orang lain.
 */
function DaftarTemuan({ temuan, k }: { temuan: TemuanUsulan[]; k: Kamus }) {
  return (
    <ul className="space-y-2">
      {temuan.map((t, i) => (
        <li
          key={`${t.kode}-${i}`}
          className={
            t.tingkat === "PEMBLOKIR"
              ? "flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              : "flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm"
          }
        >
          <TriangleAlert
            className={
              t.tingkat === "PEMBLOKIR"
                ? "mt-0.5 size-4 shrink-0 text-destructive"
                : "mt-0.5 size-4 shrink-0 text-warning"
            }
          />
          <div className="min-w-0">
            <p>
              <span className="label-teknis mr-2 text-muted-foreground/80">{t.kode}</span>
              {teksTemuan(t, k).pesan}
            </p>
            {teksTemuan(t, k).saran ? <p className="mt-0.5 text-muted-foreground">{teksTemuan(t, k).saran}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Dampak penerapan. Yang paling penting di sini bukan angka RPKPS terbit,
 * melainkan kalimat bahwa salinan bekunya TIDAK berubah — tanpa itu, bendera
 * pergeseran yang muncul setelah pengesahan terbaca sebagai kerusakan.
 */
function PanelDampak({
  dampak,
  jalurRalat,
  k,
}: {
  dampak: Awaited<ReturnType<typeof dampakUsulan>>;
  jalurRalat: boolean;
  k: Kamus;
}) {
  const adaDampak =
    dampak.rpkpsTerbit.length > 0 ||
    dampak.rpkpsBerjalan.length > 0 ||
    dampak.rujukanPensiun.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.usulan.detail.dampakJudul}</CardTitle>
        <CardDescription>
          {isi(k.usulan.detail.dampakKeteranganAwal, {
            jumlah: dampak.jumlahButirDipakai,
          })}
          {jalurRalat ? k.usulan.detail.dampakRalat : k.usulan.detail.dampakTa}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!adaDampak ? (
          <p className="text-muted-foreground">
            {k.usulan.detail.tanpaDampak}
          </p>
        ) : null}

        {dampak.rpkpsTerbit.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              {isi(k.usulan.detail.terbitTerdampak, {
                jumlah: dampak.rpkpsTerbit.length,
              })}
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rpkpsTerbit.map((r) => (
                <li key={r.id}>
                  <Tautan href={`/rpkps/${r.id}`} className="hover:underline">
                    {r.tahunAkademik}
                  </Tautan>
                  {r.koordinator ? (
                    <span className="text-muted-foreground"> · {r.koordinator}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              {k.usulan.detail.terbitCatatanAwal}{" "}
              <strong>{k.usulan.detail.terbitCatatanTebal}</strong>
              {k.usulan.detail.terbitCatatanAkhir}
            </p>
          </div>
        ) : null}

        {dampak.rpkpsBerjalan.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              {isi(k.usulan.detail.berjalan, { jumlah: dampak.rpkpsBerjalan.length })}
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rpkpsBerjalan.map((r) => (
                <li key={r.id}>
                  <Tautan href={`/rpkps/${r.id}`} className="hover:underline">
                    {r.tahunAkademik}
                  </Tautan>
                  <span className="text-muted-foreground"> · {r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dampak.rujukanPensiun.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              {k.usulan.detail.pensiunJudul}
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rujukanPensiun.map((r) => (
                <li key={r.subCpmkKode}>
                  <span className="font-mono text-xs">{r.subCpmkKode}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {isi(k.usulan.detail.pensiunRincian, {
                      pertemuan: r.pertemuan,
                      tugas: r.tugas,
                      butir: r.butirKisiKisi,
                    })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              {k.usulan.detail.pensiunCatatan}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
