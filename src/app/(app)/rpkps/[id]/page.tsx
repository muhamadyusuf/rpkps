import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList, Download, ListChecks, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { keRpkpsInput, muatKebijakan, muatRpkps, namaLengkapPengampu } from "@/lib/rpkps/muat";
import { validasiRpkps } from "@/domain/rpkps/validator";
import { ambilSnapshot, periksaPergeseran } from "@/lib/rpkps/snapshot";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { formatMenit, paguPertemuanEfektif } from "@/domain/beban-belajar/kalkulator";
import { PanelValidasi } from "./panel-validasi";
import { PanelDraf } from "./panel-draf";
import { aiTersedia } from "@/lib/ai/klien";
import { FormulirIdentitas, PengelolaKomponenNilai, PengelolaPustaka } from "./formulir";
import { TombolAjukan, TombolPutusan } from "../tombol";

export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<string, string> = {
  DRAF: "Draf",
  DIAJUKAN: "Diajukan",
  DIREVISI: "Perlu revisi",
  DISETUJUI: "Disetujui",
  TERBIT: "Terbit",
  ARSIP: "Arsip",
};

export default async function HalamanRpkpsDetail({
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

  const { kebijakan, dariDatabase } = await muatKebijakan();
  const hasil = validasiRpkps(keRpkpsInput(rpkps), kebijakan);

  const pagu = paguPertemuanEfektif(kebijakan, {
    sksTeori: rpkps.mataKuliah.sksTeori,
    sksPraktik: rpkps.mataKuliah.sksPraktik,
    bentukTeori: rpkps.mataKuliah.bentukTeori,
    bentukPraktik: rpkps.mataKuliah.bentukPraktik,
  });

  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";
  const bisaMemutuskan =
    rpkps.status === "DIAJUKAN" && punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM");

  const [snapshot, pergeseran] =
    rpkps.status === "TERBIT"
      ? await Promise.all([ambilSnapshot(id, rpkps.versi), periksaPergeseran(rpkps)])
      : [null, { ada: false as const }];

  const riwayat = await prisma.rpkpsRiwayat.findMany({
    where: { rpkpsId: id },
    orderBy: { dibuatPada: "desc" },
    take: 5,
  });

  /**
   * Nilai awal dua penyunting di bawah, dipisah dari JSX karena dipakai dua
   * kali: sebagai prop, dan sebagai `key`.
   *
   * Keduanya menyimpan isian di dalam dirinya sendiri — FormulirIdentitas pada
   * DOM lewat defaultValue, PengelolaKomponenNilai pada useState — sehingga
   * nilai awal hanya terbaca sekali, saat dipasang. Padahal isinya berubah dari
   * luar: menyetujui draf AI menulis deskripsi, kalimat pembuka, dan komponen
   * nilai, lalu memanggil router.refresh(). Tanpa `key`, penyunting bertahan
   * dengan isi lama — dosen tidak melihat hasil draf sampai halaman dimuat
   * ulang penuh — dan Base UI memperingatkan defaultValue yang berubah setelah
   * inisialisasi.
   *
   * `key` dari isi, bukan dari waktu perubahan: penyunting hanya dipasang ulang
   * bila isinya benar-benar berbeda, jadi ketikan dosen tidak hilang oleh
   * refresh yang tidak menyentuh bagian ini.
   */
  const identitasAwal = {
    deskripsi: rpkps.deskripsi ?? "",
    kalimatPembukaCpmk: rpkps.kalimatPembukaCpmk ?? "",
    ambangKelulusanMhs: Number(rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(rpkps.ambangKetercapaianMk),
    minimalKehadiranPersen: rpkps.minimalKehadiranPersen,
  };
  const komponenNilaiAwal = rpkps.komponenNilai.map((k) => ({
    nama: k.nama,
    bobot: Number(k.bobot),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/rpkps">
          <ArrowLeft />
          RPKPS
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rpkps.mataKuliah.kode}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              {rpkps.mataKuliah.nama}
            </h1>
            <Badge variant={rpkps.status === "TERBIT" ? "default" : "outline"}>
              {LABEL_STATUS[rpkps.status]}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {rpkps.tahunAkademik.kode.replace("-", " ")} ·{" "}
            {rpkps.mataKuliah.sksTeori + rpkps.mataKuliah.sksPraktik} sks (
            {rpkps.mataKuliah.sksTeori}T+{rpkps.mataKuliah.sksPraktik}P) · versi {rpkps.versi}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="outline" href={`/api/rpkps/${id}/docx`} prefetch={false}>
            <Download />
            Unduh DOCX
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/kisi-kisi`}>
            <ListChecks />
            Kisi-kisi
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/tugas`}>
            <ClipboardList />
            Tugas ({rpkps.tugas.length})
          </ButtonLink>
          <ButtonLink href={`/rpkps/${id}/mingguan`}>
            <CalendarDays />
            Rencana mingguan
          </ButtonLink>
        </div>
      </header>

      {!dariDatabase ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          Kebijakan beban belajar belum tersimpan di database — perhitungan
          memakai angka bawaan SN-Dikti.
        </p>
      ) : null}

      {snapshot ? (
        <Card
          className={
            pergeseran.ada
              ? "border-l-2 border-l-warning bg-warning/8"
              : undefined
          }
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldCheck
                className={`mt-0.5 size-5 shrink-0 ${pergeseran.ada ? "text-warning" : "text-success"}`}
              />
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {pergeseran.ada
                    ? "Isi sumber telah berubah sejak pengesahan"
                    : "Dokumen terkunci pada versi resmi"}
                </CardTitle>
                <CardDescription className="mt-1">
                  Sidik versi {snapshot.versi}:{" "}
                  <code className="rounded bg-muted px-1 font-mono">
                    {sidikRingkas(snapshot.sidik)}
                  </code>
                  {pergeseran.ada ? (
                    <>
                      {" "}
                      — data sekarang menghasilkan{" "}
                      <code className="rounded bg-muted px-1 font-mono">
                        {sidikRingkas(pergeseran.sidikSekarang)}
                      </code>
                      . Biasanya karena kurikulum disunting. Unduhan tetap
                      memakai salinan resmi; buat versi baru bila perubahan itu
                      memang ingin diberlakukan.
                    </>
                  ) : (
                    " — berkas yang diunduh identik dengan yang ditandatangani."
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {bisaSunting && aiTersedia() ? <PanelDraf rpkpsId={id} /> : null}

      <PanelValidasi hasil={hasil} />

      <div className="flex flex-wrap items-center gap-3">
        {bisaSunting ? <TombolAjukan id={id} aktif={hasil.lolos} /> : null}
        {bisaMemutuskan ? <TombolPutusan id={id} /> : null}
        {!bisaSunting && !bisaMemutuskan ? (
          <p className="text-sm text-muted-foreground">
            RPKPS berstatus {LABEL_STATUS[rpkps.status].toLowerCase()} — tidak dapat disunting.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagu waktu</CardTitle>
          <CardDescription>
            Dihitung dari kebijakan beban belajar dan pemecahan sks mata kuliah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metrik label="Per minggu efektif" nilai={formatMenit(pagu.total)} />
            <Metrik label="Tatap muka" nilai={formatMenit(pagu.tm)} />
            <Metrik label="Terjadwal" nilai={formatMenit(pagu.terjadwal)} />
            <Metrik
              label="Ruang khusus"
              nilai={pagu.ruangKhusus > 0 ? formatMenit(pagu.ruangKhusus) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capaian pembelajaran</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Read-only dari kurikulum {rpkps.mataKuliah.kurikulum.nama}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              CPL yang dibebankan
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rpkps.mataKuliah.cpl.map((m) => (
                <Badge key={m.cplId} variant="outline">
                  {m.cpl.kode}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              CPMK dan Sub-CPMK
            </p>
            <ul className="space-y-2 text-sm">
              {rpkps.mataKuliah.cpmk.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.kode}</span> — {c.rumusan}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({c.subCpmk.length} Sub-CPMK)
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/kurikulum/${rpkps.mataKuliah.kurikulum.id}/mk/${rpkps.mataKuliah.id}`}
          >
            Lihat rincian di kurikulum
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identitas dan ambang</CardTitle>
        </CardHeader>
        <CardContent>
          {bisaSunting ? (
            <FormulirIdentitas
              key={JSON.stringify(identitasAwal)}
              id={id}
              awal={identitasAwal}
            />
          ) : (
            <p className="text-sm">{rpkps.deskripsi ?? "Belum ada deskripsi."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komponen nilai</CardTitle>
          <CardDescription>
            Totalnya harus 100% dan harus sama dengan jumlah bobot pada tabel mingguan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bisaSunting ? (
            <PengelolaKomponenNilai
              key={JSON.stringify(komponenNilaiAwal)}
              rpkpsId={id}
              awal={komponenNilaiAwal}
            />
          ) : (
            <ul className="space-y-1 text-sm">
              {rpkps.komponenNilai.map((k) => (
                <li key={k.id} className="flex justify-between border-b pb-1">
                  <span>{k.nama}</span>
                  <span className="tabular-nums">{Number(k.bobot)}%</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referensi dan sumber</CardTitle>
        </CardHeader>
        <CardContent>
          {bisaSunting ? (
            <PengelolaPustaka
              rpkpsId={id}
              pustaka={rpkps.pustaka.map((p) => ({
                id: p.id,
                jenis: p.jenis,
                nomor: p.nomor,
                teks: p.teks,
                url: p.url,
              }))}
            />
          ) : (
            <ol className="space-y-1 text-sm">
              {rpkps.pustaka.map((p) => (
                <li key={p.id}>
                  {p.nomor}. {p.teks}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tim pengampu</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {rpkps.pengampu.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{namaLengkapPengampu(p.pengguna)}</span>
                {p.pengguna.nidn ? (
                  <span className="text-xs text-muted-foreground">
                    NIDN {p.pengguna.nidn}
                  </span>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    NIDN belum diisi
                  </Badge>
                )}
                {p.peran === "KOORDINATOR" ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Koordinator
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {riwayat.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histori revisi</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {riwayat.map((r) => (
                <li key={r.id} className="flex gap-3 border-b pb-2 last:border-0">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {r.dibuatPada.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="min-w-0">
                    <Badge variant="outline" className="mr-1.5 text-[10px]">
                      v{r.versi}
                    </Badge>
                    {r.deskripsi}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metrik({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums">{nilai}</p>
    </div>
  );
}
