import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList, Download, ListChecks, Lock, Scale, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi, namaMk } from "@/lib/bahasa/teks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { punyaPeran, punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { keRpkpsInput, muatKebijakan, muatRpkps, namaLengkapPengampu } from "@/lib/rpkps/muat";
import { validasiRpkps } from "@/domain/rpkps/validator";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { ambilSnapshot, periksaPergeseran, sidikRpkps } from "@/lib/rpkps/snapshot";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { formatMenit, paguPertemuanEfektif } from "@/domain/beban-belajar/kalkulator";
import { PanelValidasi } from "./panel-validasi";
import { PanelDraf } from "./panel-draf";
import { PanelTerjemahan } from "./panel-terjemahan";
import { daftarKredensial } from "@/lib/ai/kredensial";
import { FormulirIdentitas, PengelolaKomponenNilai, PengelolaPustaka } from "./formulir";
import { PanelBagikan, TimPengampu, ZonaKelola } from "./pengelola";
import { muatDataKelola } from "@/lib/rpkps/kelola";
import { jalurRpkpsPublik, urlSitus } from "@/lib/publik/tautan";
import { TombolAjukan, TombolParaf, TombolPutusan } from "../tombol";
import { statusParaf } from "@/domain/rpkps/paraf";
import { bacaDataRiwayat, teksRiwayat } from "@/lib/bahasa/riwayat";
import { kelengkapanRpkps } from "@/lib/rpkps/terjemahan";
import type { Kamus } from "@/kamus";

export const dynamic = "force-dynamic";

export default async function HalamanRpkpsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  /**
   * Gelombang pertama. Kebijakan beban belajar tidak bergantung pada dokumen
   * ini — ia milik institusi — jadi menunggunya SETELAH `muatRpkps` hanya
   * menambah satu perjalanan pulang-pergi ke basis data yang jauh, tanpa
   * menghalangi apa pun.
   */
  const [rpkps, { kebijakan, dariDatabase }] = await Promise.all([
    muatRpkps(id),
    muatKebijakan(),
  ]);
  if (!rpkps) notFound();

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  /**
   * Sidik isi SEKARANG. Ikut ke validator supaya paraf atas isi yang sudah
   * berubah tidak dihitung — lihat `statusParaf` (docs/14 §2.2).
   */
  const sidikSekarang = sidikRpkps(rpkps);
  const hasil = validasiRpkps(
    {
      ...keRpkpsInput({ ...rpkps, sidikSekarang }),
      terjemahanSebagian: kelengkapanRpkps(rpkps).sebagian,
    },
    kebijakan,
  );
  const paraf = statusParaf({
    pengampu: rpkps.pengampu.map((p) => ({
      penggunaId: p.penggunaId,
      nama: namaLengkapPengampu(p.pengguna),
      koordinator: p.peran === "KOORDINATOR",
    })),
    tandaTangan: rpkps.tandaTangan,
    versi: rpkps.versi,
    sidikSekarang,
  });
  const peta = susunPetaAsesmen(keSumberPeta(rpkps));

  const pagu = paguPertemuanEfektif(kebijakan, {
    sksTeori: rpkps.mataKuliah.sksTeori,
    sksPraktik: rpkps.mataKuliah.sksPraktik,
    bentukTeori: rpkps.mataKuliah.bentukTeori,
    bentukPraktik: rpkps.mataKuliah.bentukPraktik,
  });

  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";
  const prodiId = rpkps.mataKuliah.kurikulum.prodiId;

  /**
   * Dua putusan, dua pemilik (docs/14 §2.7). Sengaja BUKAN `wenang.pengelola`:
   * kolom yang ditandatangani berbunyi "Ketua Program Studi" dan "Kepala
   * Penjaminan Mutu Internal", jadi yang menekannya harus benar-benar mereka.
   */
  const bisaReview =
    rpkps.status === "DIAJUKAN" &&
    wenang.dalamCakupan &&
    punyaPeranDiProdi(sesi, prodiId, "KAPRODI");
  const bisaSahkan = rpkps.status === "DISETUJUI" && punyaPeran(sesi, "GPM");
  const bisaMemutuskan = bisaReview || bisaSahkan;
  const bisaParaf = bisaSunting && wenang.pengampu;

  const bolehKelola = wenang.koordinator || wenang.pengelola;

  /**
   * Alamat publik hanya ada untuk dokumen yang benar-benar terbit. Status lain
   * — termasuk ARSIP, yang justru berarti ditarik dari katalog — tidak punya
   * halaman publik, dan panel Bagikan harus mengatakannya, bukan menampilkan
   * tautan yang berakhir 404.
   */
  const urlPublik =
    rpkps.status === "TERBIT"
      ? urlSitus() +
        jalurRpkpsPublik(rpkps.mataKuliah.kurikulum.prodi.kode, rpkps.mataKuliah.kode)
      : null;

  /**
   * Gelombang kedua: seluruh sisa pemuatan, sekaligus. Empat di antaranya
   * saling bebas — panel pengelolaan, kunci AI milik dosen ini, salinan beku,
   * dan riwayat — jadi berurutan mereka membayar empat perjalanan
   * pulang-pergi untuk pekerjaan yang muat dalam satu.
   *
   * Syaratnya tetap di sini, bukan di dalam pemuatnya: yang tidak ditampilkan
   * tetap tidak dibaca dari basis data.
   */
  const [dataKelola, kredensialAi, sidikTerbit, riwayat] = await Promise.all([
    /**
     * Hanya koordinator dan pengelola prodi yang melihat panel pengelolaan —
     * dan hanya untuk mereka daftar seluruh dosen serta seluruh mata kuliah
     * ikut dimuat.
     */
    bolehKelola ? muatDataKelola(sesi, id) : null,
    // Kunci AI milik dosen yang sedang membuka halaman — bukan milik pengampu
    // lain, dan bukan kunci institusi (docs/08). Daftar kosong berarti panel
    // menawarkan mendaftarkan kunci, bukan tombol yang pasti gagal.
    bisaSunting && wenang.boleh ? daftarKredensial(sesi.id) : [],
    rpkps.status === "TERBIT"
      ? Promise.all([ambilSnapshot(id, rpkps.versi), periksaPergeseran(rpkps)])
      : null,
    prisma.rpkpsRiwayat.findMany({
      where: { rpkpsId: id },
      orderBy: { dibuatPada: "desc" },
      take: 5,
    }),
  ]);

  const [snapshot, pergeseran] = sidikTerbit ?? [null, { ada: false as const }];

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
    deskripsiEn: rpkps.deskripsiEn ?? "",
    kalimatPembukaCpmk: rpkps.kalimatPembukaCpmk ?? "",
    kalimatPembukaCpmkEn: rpkps.kalimatPembukaCpmkEn ?? "",
    ambangKelulusanMhs: Number(rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(rpkps.ambangKetercapaianMk),
    minimalKehadiranPersen: rpkps.minimalKehadiranPersen,
  };
  const komponenNilaiAwal = rpkps.komponenNilai.map((komp) => ({
    id: komp.id,
    nama: komp.nama,
    namaEn: komp.namaEn,
    bobot: Number(komp.bobot),
  }));

  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/rpkps">
          <ArrowLeft />
          {k.rpkps.ikhtisar.kembali}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rpkps.mataKuliah.kode}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              {namaMk(rpkps.mataKuliah, b)}
            </h1>
            <Badge variant={rpkps.status === "TERBIT" ? "default" : "outline"}>
              {k.enum.statusRpkps[rpkps.status]}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isi(k.rpkps.ikhtisar.ringkasan, {
              ta: rpkps.tahunAkademik.kode.replace("-", " "),
              sks: rpkps.mataKuliah.sksTeori + rpkps.mataKuliah.sksPraktik,
              teori: rpkps.mataKuliah.sksTeori,
              praktik: rpkps.mataKuliah.sksPraktik,
              versi: rpkps.versi,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            variant="outline"
            href={`/api/rpkps/${id}/docx?bahasa=${b}`}
            prefetch={false}
          >
            <Download />
            {k.rpkps.ikhtisar.unduhDocx}
          </ButtonLink>
          <ButtonLink
            variant="outline"
            href={`/api/rpkps/${id}/docx?bahasa=${b === "id" ? "en" : "id"}`}
            prefetch={false}
          >
            <Download />
            {k.dwibahasa.unduhBahasaLain}
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/kelas`}>
            <Users />
            {k.rpkps.ikhtisar.kelasNilai}
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/asesmen`}>
            <Scale />
            {k.rpkps.ikhtisar.petaAsesmen}
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/kisi-kisi`}>
            <ListChecks />
            {k.rpkps.ikhtisar.kisiKisi}
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/tugas`}>
            <ClipboardList />
            {isi(k.rpkps.ikhtisar.tugasNav, { jumlah: rpkps.tugas.length })}
          </ButtonLink>
          <ButtonLink variant="outline" href={`/rpkps/${id}/mingguan`}>
            <CalendarDays />
            {k.rpkps.ikhtisar.rencanaMingguan}
          </ButtonLink>
        </div>
      </header>

      {!dariDatabase ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm">
          {k.rpkps.ikhtisar.kebijakanBawaan}
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
                    ? k.rpkps.ikhtisar.sumberBergeser
                    : k.rpkps.ikhtisar.terkunciResmi}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isi(k.rpkps.ikhtisar.sidikVersi, { versi: snapshot.versi })}{" "}
                  <code className="rounded bg-muted px-1 font-mono">
                    {sidikRingkas(snapshot.sidik)}
                  </code>
                  {pergeseran.ada ? (
                    <>
                      {" "}
                      {k.rpkps.ikhtisar.sekarangMenghasilkan}{" "}
                      <code className="rounded bg-muted px-1 font-mono">
                        {sidikRingkas(pergeseran.sidikSekarang)}
                      </code>
                      {k.rpkps.ikhtisar.pergeseranAkhir}
                    </>
                  ) : (
                    k.rpkps.ikhtisar.identikTtd
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {bisaSunting && wenang.boleh ? (
        <PanelDraf rpkpsId={id} kredensial={kredensialAi} />
      ) : null}

      <PanelValidasi hasil={hasil} />

      <PanelKelengkapan kelengkapan={kelengkapanRpkps(rpkps)} k={k} />

      {bisaSunting && wenang.boleh ? (
        <PanelTerjemahan rpkpsId={id} kredensial={kredensialAi} />
      ) : null}

      <Card className={peta.lolos ? undefined : "border-l-2 border-l-warning bg-warning/8"}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {peta.lolos
                  ? k.rpkps.ikhtisar.petaTertutup
                  : k.rpkps.ikhtisar.petaBelumSiap}
              </CardTitle>
              <CardDescription className="mt-1">
                {isi(k.rpkps.ikhtisar.petaRingkas, {
                  asesmen: peta.ringkasan.jumlahAsesmen,
                  bobot: peta.ringkasan.totalBobot,
                  subTerukur: peta.ringkasan.subCpmkTerukur,
                  subSeluruh: peta.ringkasan.subCpmkSeluruh,
                  cplTerukur: peta.ringkasan.cplTerukur,
                  cplDibebankan: peta.ringkasan.cplDibebankan,
                })}
                {peta.lolos
                  ? null
                  : isi(k.rpkps.ikhtisar.petaTemuan, {
                      jumlah: peta.pemblokir.length,
                    })}
              </CardDescription>
            </div>
            <ButtonLink variant="outline" size="sm" href={`/rpkps/${id}/asesmen`}>
              {k.rpkps.ikhtisar.lihatPeta}
            </ButtonLink>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {bisaParaf ? (
          <TombolParaf
            id={id}
            sudah={paraf.sudah.some((p) => p.penggunaId === sesi.id)}
          />
        ) : null}
        {bisaSunting && wenang.koordinator ? (
          <TombolAjukan id={id} aktif={hasil.lolos} />
        ) : null}
        {bisaMemutuskan ? (
          <TombolPutusan id={id} tahap={bisaReview ? "REVIEW" : "PENGESAHAN"} />
        ) : null}
        {!bisaParaf && !bisaMemutuskan && !(bisaSunting && wenang.koordinator) ? (
          <p className="text-sm text-muted-foreground">
            {isi(k.rpkps.ikhtisar.takDapatDisunting, {
              status: k.enum.statusRpkps[rpkps.status].toLowerCase(),
            })}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.ikhtisar.paguJudul}</CardTitle>
          <CardDescription>{k.rpkps.ikhtisar.paguKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metrik
              label={k.rpkps.ikhtisar.paguMingguEfektif}
              nilai={formatMenit(pagu.total)}
            />
            <Metrik label={k.rpkps.ikhtisar.paguTm} nilai={formatMenit(pagu.tm)} />
            <Metrik
              label={k.rpkps.ikhtisar.paguTerjadwal}
              nilai={formatMenit(pagu.terjadwal)}
            />
            <Metrik
              label={k.rpkps.ikhtisar.paguRuangKhusus}
              nilai={pagu.ruangKhusus > 0 ? formatMenit(pagu.ruangKhusus) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.ikhtisar.capaianJudul}</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5" />
            {isi(k.rpkps.ikhtisar.readOnlyDari, {
              nama: rpkps.mataKuliah.kurikulum.nama,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.rpkps.ikhtisar.cplDibebankan}
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
              {k.rpkps.ikhtisar.cpmkDanSub}
            </p>
            <ul className="space-y-2 text-sm">
              {rpkps.mataKuliah.cpmk.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.kode}</span> — {c.rumusan}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {isi(k.rpkps.ikhtisar.jumlahSub, { jumlah: c.subCpmk.length })}
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
            {k.rpkps.ikhtisar.lihatDiKurikulum}
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.ikhtisar.identitasJudul}</CardTitle>
        </CardHeader>
        <CardContent>
          {bisaSunting ? (
            <FormulirIdentitas
              key={JSON.stringify(identitasAwal)}
              id={id}
              awal={identitasAwal}
            />
          ) : (
            <p className="text-sm">{rpkps.deskripsi ?? k.rpkps.ikhtisar.tanpaDeskripsi}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.ikhtisar.komponenJudul}</CardTitle>
          <CardDescription>{k.rpkps.ikhtisar.komponenKeterangan}</CardDescription>
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
              {rpkps.komponenNilai.map((komp) => (
                <li key={komp.id} className="flex justify-between border-b pb-1">
                  <span>{komp.nama}</span>
                  <span className="tabular-nums">{Number(komp.bobot)}%</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.ikhtisar.pustakaJudul}</CardTitle>
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

      <TimPengampu
        rpkpsId={id}
        bolehKelola={bolehKelola}
        calon={dataKelola?.calon ?? []}
        pengampu={rpkps.pengampu.map((p) => ({
          penggunaId: p.penggunaId,
          nama: namaLengkapPengampu(p.pengguna),
          nidn: p.pengguna.nidn,
          koordinator: p.peran === "KOORDINATOR",
        }))}
      />

      <PanelBagikan
        rpkpsId={id}
        urlPublik={urlPublik}
        statusLabel={k.enum.statusRpkps[rpkps.status] ?? rpkps.status}
      />

      {dataKelola ? (
        <ZonaKelola
          rpkpsId={id}
          status={rpkps.status}
          kodeMk={rpkps.mataKuliah.kode}
          alasanTakDapatDihapus={dataKelola.alasanTakDapatDihapus}
          akibatHapusPaksa={dataKelola.akibatHapusPaksa}
          bolehHapusPaksa={dataKelola.bolehHapusPaksa}
          sasaran={dataKelola.sasaran}
          tahun={dataKelola.tahun}
        />
      ) : null}

      {riwayat.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.ikhtisar.historiJudul}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {riwayat.map((r) => (
                <li key={r.id} className="flex gap-3 border-b pb-2 last:border-0">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {tanggal(r.dibuatPada, b, "pendek")}
                  </span>
                  <span className="min-w-0">
                    <Badge variant="outline" className="mr-1.5 text-[10px]">
                      v{r.versi}
                    </Badge>
                    {teksRiwayat(bacaDataRiwayat(r.data), r.deskripsi, k)}
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

/**
 * Kelengkapan terjemahan. Angka, bukan tuntutan: terjemahan tidak pernah
 * menghalangi pengajuan (docs/11 §5.6), jadi panel ini memakai nada netral —
 * bukan peringatan.
 */
function PanelKelengkapan({
  kelengkapan,
  k,
}: {
  kelengkapan: ReturnType<typeof kelengkapanRpkps>;
  k: Kamus;
}) {
  const { terisi, total, persen } = kelengkapan;
  if (total === 0) return null;

  const kalimat =
    terisi === 0
      ? k.dwibahasa.kelengkapanKosong
      : terisi === total
        ? k.dwibahasa.kelengkapanPenuh
        : isi(k.dwibahasa.kelengkapan, { terisi, total });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.dwibahasa.kelengkapanJudul}</CardTitle>
        <CardDescription>{k.dwibahasa.kelengkapanKeterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm">{kalimat}</span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {persen}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-cahaya/60" style={{ width: `${persen}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
