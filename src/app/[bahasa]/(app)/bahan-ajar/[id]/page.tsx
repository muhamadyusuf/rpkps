import { notFound } from "next/navigation";
import {
  BookOpen,
  CircleAlert,
  FileDown,
  Presentation,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import { teksTemuan } from "@/lib/bahasa/temuan";
import { daftarKredensial } from "@/lib/ai/kredensial";
import { keInputPemeriksaan, muatBuku, sidikSekarang } from "@/lib/bahan-ajar/muat";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { periksaBukuAjar } from "@/domain/bahan-ajar/validator";
import { babBergeser } from "@/domain/bahan-ajar/sidik-sumber";
import { periksaNaskah } from "@/domain/bahan-ajar/naskah";
import { periksaKesiapanTerbit } from "@/domain/bahan-ajar/kesiapan-terbit";
import { bacaGlosarium } from "@/lib/bahan-ajar/cetak";
import { PanelUsulan } from "./panel-usulan";
import { PanelTerbit } from "./panel-terbit";
import { FormulirMetadata } from "./metadata";
import { PanelAi } from "./panel-ai";
import { TombolHapusBuku } from "./tombol";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const buku = await muatBuku(id);
  return { title: buku?.judul ?? (await kamus()).bahanAjar.metaJudul };
}

export default async function HalamanBuku({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const w = await wenangBuku(id);
  if (!w.ada || !w.bolehLihat) notFound();

  const buku = await muatBuku(id);
  if (!buku) notFound();

  const k = await kamus();
  const b = await bahasaAktif();

  const periksa = periksaBukuAjar(keInputPemeriksaan(buku));
  const sidik = sidikSekarang(buku);

  /*
   * Pemeriksaan naskah dan kesiapan terbit dihitung DI SINI setiap kali
   * halaman dibuka, tidak disimpan: keduanya deterministik, jadi menghitung
   * ulang lebih murah daripada menjaga baris basi tetap sejalan (docs/19 §2.1).
   */
  const nomorPustaka = new Map(buku.rpkps.pustaka.map((p) => [p.id, p.nomor]));
  const glosarium = bacaGlosarium(buku.glosarium);
  const naskah = periksaNaskah({
    bab: buku.bab.map((b) => ({
      nomor: b.nomor,
      judul: b.judul,
      tujuan: b.tujuan,
      uraian: b.uraian,
      ringkasan: b.ringkasan,
      sitiran: b.pustaka
        .map((x) => nomorPustaka.get(x.pustakaId))
        .filter((n): n is number => n !== undefined),
    })),
    glosarium,
    pustaka: buku.rpkps.pustaka.map((p) => ({ nomor: p.nomor })),
  });

  const kesiapan = periksaKesiapanTerbit({
    judul: buku.judul,
    penulis: buku.penulis,
    penerbit: buku.penerbit,
    kotaTerbit: buku.kotaTerbit,
    tahunTerbit: buku.tahunTerbit,
    isbn: buku.isbn,
    prakata: buku.prakata,
    sinopsis: buku.sinopsis,
    kataKunci: buku.kataKunci,
    glosarium,
    pustaka: buku.rpkps.pustaka.map((p) => ({ nomor: p.nomor })),
    bab: buku.bab.map((b) => ({
      nomor: b.nomor,
      adaUraian: Boolean(b.uraian?.trim()),
      disunting: b.disuntingPada !== null,
    })),
    jumlahKata: naskah.ringkasan.jumlahKata,
    usulanTerbuka: buku.usulan.length,
  });

  const nomorBabDari = new Map(buku.bab.map((b) => [b.id, b.nomor]));

  // Kunci AI hanya dimuat bila memang ada tombolnya. Bagi pembaca yang tidak
  // berwenang menulis, satu kueri ini murni terbuang.
  const kredensial = w.bolehTulis ? await daftarKredensial(w.sesi.id) : [];

  const mk = buku.rpkps.mataKuliah;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.bahanAjar.sampulEyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{buku.judul}</h1>
        {buku.subjudul ? (
          <p className="mt-1 text-sm text-muted-foreground">{buku.subjudul}</p>
        ) : null}
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Tautan
            href={`/rpkps/${buku.rpkpsId}`}
            className="underline-offset-4 hover:underline"
          >
            {mk.kode} — {namaMk(mk, b)}
          </Tautan>
          <span>·</span>
          <span>{buku.rpkps.tahunAkademik.kode.replace("-", " ")}</span>
          <Badge variant="outline">
            {buku.bahasa === "en" ? k.bahanAjar.bahasaEn : k.bahanAjar.bahasaId}
          </Badge>
        </p>
      </header>

      {/* Kesiapan naskah: kalimatnya dirakit dari kode temuan, dalam bahasa
          pembacanya — validator sendiri tidak mengenal satu kalimat pun. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.bahanAjar.periksaJudul}</CardTitle>
          <CardDescription>
            {isi(k.bahanAjar.babRingkas, {
              berisi: periksa.ringkasan.babBerisi,
              total: periksa.ringkasan.jumlahBab,
            })}
            {" · "}
            {isi(k.bahanAjar.slideRingkas, { jumlah: periksa.ringkasan.jumlahSlide })}
            {" · "}
            {isi(k.bahanAjar.latihanRingkas, { jumlah: periksa.ringkasan.jumlahLatihan })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {periksa.temuan.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.bahanAjar.periksaLolos}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {periksa.temuan.map((t, i) => {
                const kalimat = teksTemuan(t, k);
                return (
                  <li key={`${t.kode}-${i}`} className="flex items-start gap-2">
                    {t.tingkat === "PEMBLOKIR" ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      {kalimat.pesan}
                      {kalimat.saran ? (
                        <span className="block text-xs text-muted-foreground">
                          {kalimat.saran}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {w.bolehTulis ? (
        <PanelAi
          bukuId={buku.id}
          bab={buku.bab.map((x) => ({ nomor: x.nomor, berisi: Boolean(x.uraian?.trim()) }))}
          kredensial={kredensial.map((x) => ({
            id: x.id,
            penyedia: x.penyedia,
            label: x.label,
            ekor: x.ekor,
            modelEfektif: x.modelEfektif,
            bawaan: x.bawaan,
          }))}
        />
      ) : null}

      <PanelTerbit
        bukuId={buku.id}
        temuan={kesiapan.temuan}
        siap={kesiapan.siap}
        ringkasan={kesiapan.ringkasan}
        sinopsisAwal={buku.sinopsis}
        kataKunciAwal={buku.kataKunci}
        bolehTulis={w.bolehTulis}
        adaKunciAi={kredensial.length > 0}
      />

      <PanelUsulan
        bukuId={buku.id}
        bolehTulis={w.bolehTulis}
        adaKunciAi={kredensial.length > 0}
        tinjauSeluruh
        usulan={buku.usulan.map((u) => ({
          id: u.id,
          babNomor: u.babId ? (nomorBabDari.get(u.babId) ?? null) : null,
          jenis: u.jenis,
          kutipan: u.kutipan,
          usul: u.usul,
          alasan: u.alasan,
        }))}
      />

      {/* Temuan mekanis: dihitung tanpa memakai kuota AI dosen. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.bahanAjar.naskahJudul}</CardTitle>
          <CardDescription>{k.bahanAjar.naskahKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          {naskah.temuan.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.bahanAjar.naskahBersih}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {naskah.temuan.map((t, i) => {
                const kalimat = teksTemuan(t, k);
                return (
                  <li key={`${t.kode}-${i}`} className="flex items-start gap-2">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      {t.bab !== undefined ? (
                        <span className="mr-1 text-xs text-muted-foreground">
                          {isi(k.bahanAjar.babEyebrow, { nomor: t.bab })} ·
                        </span>
                      ) : null}
                      {kalimat.pesan}
                      {kalimat.saran ? (
                        <span className="block text-xs text-muted-foreground">
                          {kalimat.saran}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isi(k.bahanAjar.babJudul, { jumlah: buku.bab.length })}
          </CardTitle>
          <CardDescription>{k.bahanAjar.babKeterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {buku.bab.map((bab) => {
              const sekarang = bab.pertemuanId ? (sidik.get(bab.pertemuanId) ?? null) : null;
              const hilang = !bab.pertemuanId || !sidik.has(bab.pertemuanId);
              return (
                <li
                  key={bab.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <Tautan
                      href={`/bahan-ajar/${buku.id}/bab/${bab.nomor}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {bab.nomor}. {bab.judul}
                    </Tautan>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isi(k.bahanAjar.latihanRingkas, { jumlah: bab.latihan.length })}
                      {" · "}
                      {isi(k.bahanAjar.slideRingkas, { jumlah: bab.slide.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!bab.uraian?.trim() ? (
                      <Badge variant="outline">{k.bahanAjar.babKosongIsi}</Badge>
                    ) : bab.disuntingPada ? (
                      <Badge variant="secondary">{k.bahanAjar.babDisunting}</Badge>
                    ) : (
                      <Badge variant="outline">{k.bahanAjar.babAi}</Badge>
                    )}
                    {hilang ? (
                      <Badge variant="destructive">{k.bahanAjar.babMingguHilang}</Badge>
                    ) : babBergeser(bab.sidikSumber, sekarang) ? (
                      <Badge variant="destructive">{k.bahanAjar.babBergeser}</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <FormulirMetadata
        bukuId={buku.id}
        bolehTulis={w.bolehTulis}
        awal={{
          judul: buku.judul,
          subjudul: buku.subjudul,
          penulis: buku.penulis,
          afiliasi: buku.afiliasi,
          penerbit: buku.penerbit,
          kotaTerbit: buku.kotaTerbit,
          tahunTerbit: buku.tahunTerbit,
          edisi: buku.edisi,
          isbn: buku.isbn,
          hakCipta: buku.hakCipta,
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <FileDown className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{k.bahanAjar.unduhJudul}</CardTitle>
              <CardDescription className="mt-1">
                {k.bahanAjar.unduhKeterangan}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* Alamat API tidak berawalan bahasa, jadi ia memang ditulis utuh —
              bahasa berkasnya datang dari `buku.bahasa`, bukan dari alamat. */}
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/api/bahan-ajar/${buku.id}/docx`}
            prefetch={false}
          >
            <FileDown className="size-4" />
            {k.bahanAjar.unduhDocx}
          </ButtonLink>
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/api/bahan-ajar/${buku.id}/docx?kunci=0`}
            prefetch={false}
          >
            <FileDown className="size-4" />
            {k.bahanAjar.unduhTanpaKunci}
          </ButtonLink>
          {/* Slide tidak punya ragam "tanpa kunci": kunci jawaban tidak pernah
              tercetak di slide sama sekali (docs/16 §4.2). */}
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/api/bahan-ajar/${buku.id}/pptx`}
            prefetch={false}
          >
            <Presentation className="size-4" />
            {k.bahanAjar.unduhPptx}
          </ButtonLink>
        </CardContent>
      </Card>

      {buku.prakata || buku.pendahuluan ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <CardTitle className="text-base">{k.bahanAjar.tombolKelengkapan}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm whitespace-pre-wrap">
            {buku.prakata ? <p>{buku.prakata}</p> : null}
            {buku.pendahuluan ? (
              <p className="text-muted-foreground">{buku.pendahuluan}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {w.bolehTulis ? <TombolHapusBuku bukuId={buku.id} /> : null}
    </div>
  );
}
