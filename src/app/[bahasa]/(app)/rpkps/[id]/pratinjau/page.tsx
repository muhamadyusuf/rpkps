import { notFound } from "next/navigation";
import { ArrowLeft, Languages, ShieldCheck, TriangleAlert } from "lucide-react";
import { adalahBahasa, type Bahasa } from "@/kamus";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps } from "@/lib/rpkps/muat";
import { rakitDariRpkps } from "@/lib/dokumen/rakit-naskah";
import { labelDokumen } from "@/lib/dokumen/label";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { sidikRpkps } from "@/lib/rpkps/snapshot";
import { NaskahRpkps } from "./naskah";
import { GayaCetakNaskah } from "./gaya-cetak";
import { TombolUnduh } from "../tombol-unduh";
import { TombolCetak } from "./tombol-cetak";

/**
 * Pratinjau naskah RPKPS DI DALAM aplikasi — kertasnya, bukan halaman webnya.
 *
 * Penyusun RPKPS memperlihatkan borang: satu tab per bagian, satu kartu per
 * baris. Yang ditandatangani Kaprodi dan Penjaminan Mutu bukan itu, melainkan
 * DOKUMEN — dan sampai halaman ini ada, satu-satunya cara melihatnya adalah
 * mengunduh DOCX, membukanya di Word, lalu mengulanginya setiap kali satu
 * baris disunting. Halaman ini menampilkan lembar A4 yang sama, dan tombol
 * Cetak peramban mengubahnya menjadi PDF.
 *
 * Tiga hal yang membuatnya dapat dipercaya:
 *
 *  1. **Naskahnya dirakit `rakitNaskahRpkps`, sama persis dengan yang dipakai
 *     unduhan DOCX.** Salinan beku yang sama untuk dokumen TERBIT, tanda
 *     tangan yang sama, sidik yang sama, pemilihan bahasa yang sama. Merakit
 *     sendiri di sini akan membuat pratinjau menyimpang dari berkasnya tanpa
 *     satu gejala pun.
 *  2. **Kata-katanya dari `labelDokumen`, kamus yang sama dengan DOCX** —
 *     bukan dari kamus antarmuka. Judul bagian A–J adalah bagian dari
 *     template, bukan bagian dari aplikasi.
 *  3. **Ini BUKAN pintu tanpa login.** Ia tidak menyentuh
 *     `src/lib/publik/muat.ts` maupun `src/lib/berbagi/muat.ts` (docs/06
 *     §4.3); gerbangnya `wenangAtasRpkps`, sama seperti halaman ikhtisar.
 */

export const dynamic = "force-dynamic";

type Params = { id: string };
type Query = Record<string, string | string[] | undefined>;

/**
 * Bahasa NASKAH, terpisah dari bahasa antarmuka.
 *
 * Kaprodi berbahasa Indonesia perlu memeriksa naskah Inggris sebelum
 * mengesahkannya, dan memaksanya mengganti bahasa seluruh aplikasi untuk itu
 * berarti ia kehilangan tempatnya di halaman. Bawaannya tetap bahasa
 * antarmuka — tebakan yang benar hampir selalu.
 */
function bahasaNaskah(query: Query, bawaan: Bahasa): Bahasa {
  const nilai = Array.isArray(query.bahasa) ? query.bahasa[0] : query.bahasa;
  return adalahBahasa(nilai) ? nilai : bawaan;
}

export default async function HalamanPratinjauRpkps({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const sesi = await wajibAktif();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const [rpkps, k, bAntarmuka] = await Promise.all([
    muatRpkps(id),
    kamus(),
    bahasaAktif(),
  ]);
  if (!rpkps) notFound();
  if (!wenangAtasRpkps(sesi, rpkps).bolehLihat) notFound();

  const bDok = bahasaNaskah(query, bAntarmuka);
  const p = k.rpkps.pratinjau;

  const { naskah, riwayat, ttd, sidik } = await rakitDariRpkps(rpkps, { bahasa: bDok });

  /**
   * Pergeseran dihitung dari sidik yang sudah di tangan, bukan lewat
   * `periksaPergeseran` — pemanggilan itu akan membaca salinan beku yang sama
   * untuk kedua kalinya, dan basis datanya jauh. Perbandingannya selalu di
   * ruang sidik INDONESIA: itu satu-satunya ruang yang punya padanan pada data
   * langsung, dan naskah Inggris tidak pernah dibandingkan dengannya.
   */
  const bergeser =
    rpkps.status === "TERBIT" &&
    sidik !== null &&
    bDok === "id" &&
    sidikRpkps(rpkps) !== sidik;

  return (
    <div className="space-y-6">
      <GayaCetakNaskah />

      <div className="print:hidden">
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}`}>
          <ArrowLeft />
          {p.kembali}
        </ButtonLink>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {rpkps.mataKuliah.kode}
          </Badge>
          <h1 className="text-lg font-semibold tracking-tight">{p.judul}</h1>
          <Badge variant={rpkps.status === "TERBIT" ? "default" : "outline"}>
            {k.enum.statusRpkps[rpkps.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TombolUnduh
            basis={`/api/rpkps/${id}/docx`}
            label={k.rpkps.ikhtisar.unduhDocx}
          />
          <TombolCetak label={p.cetakPdf} />
          <SakelarBahasa
            id={id}
            aktif={bDok}
            labelId={k.dwibahasa.modeId}
            labelEn={k.dwibahasa.modeEn}
            judul={p.bahasaDokumen}
          />
        </div>
      </header>

      {/*
        Satu pita, dan isinya ditentukan status. Draf mengatakan "belum
        disahkan"; dokumen terbit menyebut sidik yang ditandatangani, dan
        menambahkan peringatan hanya bila data sumber benar-benar sudah
        bergeser darinya.
      */}
      {sidik ? (
        <div
          className={`panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 print:hidden ${
            bergeser ? "border-l-2 border-l-warning bg-warning/8" : "bg-card"
          }`}
        >
          <ShieldCheck
            className={`size-5 shrink-0 ${bergeser ? "text-warning" : "text-success"}`}
          />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{isi(p.resmi, { versi: rpkps.versi })}</span>{" "}
            <span className="text-muted-foreground">
              {bergeser ? p.bergeser : p.resmiKeterangan}
            </span>
          </p>
          <code
            title={sidik}
            className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
          >
            {bDok === "en" ? "EN " : ""}
            {sidikRingkas(sidik)}
          </code>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-l-2 border-l-warning bg-warning/10 p-4 print:hidden">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-medium">{p.draf}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.drafKeterangan}</p>
          </div>
        </div>
      )}

      <NaskahRpkps
        r={naskah}
        L={labelDokumen(bDok)}
        ttd={ttd}
        riwayat={riwayat}
        sidik={sidik}
        bahasa={bDok}
      />

      <p className="text-center text-xs text-muted-foreground print:hidden">
        {p.catatanLembar}
      </p>
    </div>
  );
}

/**
 * Sakelar bahasa naskah. Tautan biasa, bukan tombol berkeadaan: alamatnya
 * dapat disalin dan dikirim ke rekan setim, dan halaman ini memang dibaca
 * berdua.
 */
function SakelarBahasa({
  id,
  aktif,
  labelId,
  labelEn,
  judul,
}: {
  id: string;
  aktif: Bahasa;
  labelId: string;
  labelEn: string;
  judul: string;
}) {
  const pilihan: { kode: Bahasa; label: string }[] = [
    { kode: "id", label: labelId },
    { kode: "en", label: labelEn },
  ];

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={judul}>
      <Languages className="size-4 text-muted-foreground" />
      {pilihan.map(({ kode, label }) => (
        <Tautan
          key={kode}
          href={`/rpkps/${id}/pratinjau?bahasa=${kode}`}
          aria-current={kode === aktif ? "true" : undefined}
          className={
            kode === aktif
              ? "rounded-md border border-cahaya/45 bg-cahaya/12 px-2.5 py-1 text-xs font-medium"
              : "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-cahaya/35 hover:text-foreground"
          }
        >
          {label}
        </Tautan>
      ))}
    </div>
  );
}
