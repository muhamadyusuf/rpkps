import { notFound } from "next/navigation";
import Link from "next/link";
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
  LABEL_DASAR,
  LABEL_JENIS,
  LABEL_STATUS,
  LABEL_STATUS_BUTIR,
  VARIAN_STATUS,
} from "../label";
import { FormulirButir, TombolHapusButir } from "./butir";
import { Diskusi } from "./diskusi";
import { KeputusanButir, TindakanPemutus, TindakanPengusul } from "./keputusan";

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/usulan">
          <ArrowLeft />
          Usulan Revisi
        </ButtonLink>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={VARIAN_STATUS[usulan.status]}>{LABEL_STATUS[usulan.status]}</Badge>
          <Link
            href={`/kurikulum/${usulan.kurikulumId}/mk/${usulan.mataKuliahId}`}
            className="inline-flex"
          >
            <Badge variant="outline">{usulan.mataKuliah.kode}</Badge>
          </Link>
          {usulan.jalurRalat ? <Badge variant="secondary">Ralat · berlaku segera</Badge> : null}
          {usulan.revisi ? (
            <Badge variant="secondary">Revisi {usulan.revisi.revisiKe}</Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{usulan.judul}</h1>
        <p className="text-sm text-muted-foreground">
          {usulan.mataKuliah.nama} · {usulan.kurikulum.nama} ({usulan.kurikulum.tahun}) ·
          diajukan {usulan.diajukanOleh.nama}
          {usulan.berlakuMulaiTa ? ` · berlaku ${usulan.berlakuMulaiTa.kode}` : ""}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latar belakang</CardTitle>
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
              Catatan {usulan.diputuskanOleh?.nama ?? "Ketua Program Studi"}
            </p>
            <p className="mt-0.5 text-muted-foreground">{usulan.catatanPemutus}</p>
          </div>
        </div>
      ) : null}

      {usulan.revisi?.disahkanSendiri ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Usulan ini diajukan dan disahkan oleh orang yang sama. Dicatat terbuka
            sebagai bagian dari jejak audit — bukan pelanggaran, tetapi fakta yang
            berhak diketahui asesor.
          </p>
        </div>
      ) : null}

      <PanelTemuan temuan={temuanUmum} lolos={hasil.lolos} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Butir perubahan ({usulan.butir.length})
        </h2>

        {usulan.butir.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Belum ada butir. Usulan tanpa butir tidak dapat diajukan.
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
                  <Badge>{LABEL_JENIS[b.jenis]}</Badge>
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
                      Draf AI
                    </Badge>
                  ) : null}
                  {b.status !== "BARU" ? (
                    <Badge variant={b.status === "DITOLAK" ? "destructive" : "secondary"}>
                      {LABEL_STATUS_BUTIR[b.status]}
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
                      <p className="label-teknis text-muted-foreground/80">Sekarang</p>
                      <p className="mt-1.5 text-sm">
                        {sekarang ?? (
                          <span className="text-muted-foreground">
                            Belum ada — capaian ini baru.
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="panel rounded-lg border border-ring/40 p-3">
                      <p className="label-teknis text-muted-foreground/80">Usulan</p>
                      <p className="mt-1.5 text-sm">{b.rumusan}</p>
                    </div>
                  </div>
                ) : null}

                {b.cplKode.length > 0 ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Peta CPL: </span>
                    {b.cplKode.join(", ")}
                  </p>
                ) : null}
                {b.mingguDisarankan.length > 0 ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Minggu disarankan: </span>
                    {b.mingguDisarankan.join(", ")}
                  </p>
                ) : null}

                <div>
                  <p className="label-teknis text-muted-foreground/80">Alasan</p>
                  <p className="mt-1 text-sm">{b.alasan}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="label-teknis text-muted-foreground/80">Dasar</p>
                  {b.dasar.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge variant="secondary" className="text-[10px]">
                        {LABEL_DASAR[d.jenis]}
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
                      Catatan Ketua Program Studi
                    </p>
                    <p className="mt-1">{b.catatanPemutus}</p>
                  </div>
                ) : null}

                {temuan.length > 0 ? <DaftarTemuan temuan={temuan} /> : null}

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
        <PanelDampak dampak={dampak} jalurRalat={usulan.jalurRalat} />
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

function PanelTemuan({ temuan, lolos }: { temuan: TemuanUsulan[]; lolos: boolean }) {
  if (lolos && temuan.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-muted-foreground">
          Tidak ada temuan pemblokir. Usulan ini tidak merusak rantai CPL → CPMK →
          Sub-CPMK bila diterapkan.
        </p>
      </div>
    );
  }
  if (temuan.length === 0) return null;
  return <DaftarTemuan temuan={temuan} />;
}

/**
 * Hanya temuan yang DIBAWA usulan ini yang tampil — temuan warisan kurikulum
 * disaring di domain, supaya Kaprodi tidak dihujani kesalahan orang lain.
 */
function DaftarTemuan({ temuan }: { temuan: TemuanUsulan[] }) {
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
              {t.pesan}
            </p>
            {t.saran ? <p className="mt-0.5 text-muted-foreground">{t.saran}</p> : null}
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
}: {
  dampak: Awaited<ReturnType<typeof dampakUsulan>>;
  jalurRalat: boolean;
}) {
  const adaDampak =
    dampak.rpkpsTerbit.length > 0 ||
    dampak.rpkpsBerjalan.length > 0 ||
    dampak.rujukanPensiun.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dampak penerapan</CardTitle>
        <CardDescription>
          {dampak.jumlahButirDipakai} butir akan ditulis ke kurikulum
          {jalurRalat ? " dan berlaku segera." : " mulai tahun akademik yang dipilih."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!adaDampak ? (
          <p className="text-muted-foreground">
            Belum ada RPKPS yang memakai mata kuliah ini, jadi tidak ada dokumen
            yang terpengaruh.
          </p>
        ) : null}

        {dampak.rpkpsTerbit.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              RPKPS terbit yang terdampak ({dampak.rpkpsTerbit.length})
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rpkpsTerbit.map((r) => (
                <li key={r.id}>
                  <Link href={`/rpkps/${r.id}`} className="hover:underline">
                    {r.tahunAkademik}
                  </Link>
                  {r.koordinator ? (
                    <span className="text-muted-foreground"> · {r.koordinator}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Salinan beku dan halaman publiknya <strong>tidak berubah</strong>.
              Yang berubah hanya data langsung, sehingga dokumen ini akan menandai
              pergeseran isi — dengan revisi ini sebagai penjelasannya.
            </p>
          </div>
        ) : null}

        {dampak.rpkpsBerjalan.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              RPKPS yang masih disusun ({dampak.rpkpsBerjalan.length})
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rpkpsBerjalan.map((r) => (
                <li key={r.id}>
                  <Link href={`/rpkps/${r.id}`} className="hover:underline">
                    {r.tahunAkademik}
                  </Link>
                  <span className="text-muted-foreground"> · {r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dampak.rujukanPensiun.length > 0 ? (
          <div>
            <p className="label-teknis text-muted-foreground/80">
              Capaian yang dipensiunkan masih dirujuk
            </p>
            <ul className="mt-1.5 space-y-1">
              {dampak.rujukanPensiun.map((r) => (
                <li key={r.subCpmkKode}>
                  <span className="font-mono text-xs">{r.subCpmkKode}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.pertemuan} pertemuan · {r.tugas} tugas · {r.butirKisiKisi} butir
                    kisi-kisi
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Baris-baris itu tetap utuh. Pensiun berarti tidak ditawarkan lagi untuk
              RPKPS baru, bukan dihapus dari dokumen yang sudah menggunakannya.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
