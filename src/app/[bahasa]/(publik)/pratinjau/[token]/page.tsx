import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { muatPratinjau } from "@/lib/berbagi/muat";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi, namaMk } from "@/lib/bahasa/teks";
import { ringkasSks } from "@/domain/rpkps/publik";
import {
  Bagian,
  BagianCapaian,
  BagianDeskripsi,
  BagianMingguan,
  BagianPengampu,
  BagianPenilaian,
  BagianPustaka,
  BagianTugas,
} from "@/app/[bahasa]/(publik)/katalog/[prodi]/[kode]/bagian";

/**
 * Tautan pratinjau bertoken — docs/06 §4.2 (tahap B5).
 *
 * Halaman ini memperlihatkan dokumen yang BELUM disahkan kepada orang tanpa
 * akun: mitra industri yang diminta menilai penyelarasan, asesor sebelum
 * visitasi. Karena itu ia berdiri di atas tiga hal yang tidak boleh dilonggarkan:
 *
 *  1. **Selalu bertanda draf**, dan pitanya tidak dapat disembunyikan.
 *  2. **Tanpa sidik SHA-256.** Sidik hanya milik salinan beku; mencetaknya di
 *     sini akan membuat draf tampak seresmi dokumen yang ditandatangani.
 *  3. **Tidak pernah terindeks** — `noindex, nofollow`, di luar sitemap, di
 *     luar katalog, tanpa kartu OpenGraph.
 *
 * Dan satu lagi yang tidak terlihat di layar: halaman ini hanya memuat RPKPS.
 * Tidak ada kelas, nilai, maupun evaluasi — nilai mahasiswa tidak boleh punya
 * jalur tanpa login.
 */

export const dynamic = "force-dynamic";

type Params = { token: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const [{ token }, k] = await Promise.all([params, kamus()]);
  const pratinjau = await muatPratinjau(token);

  return {
    title: pratinjau
      ? `${pratinjau.mk.kode} — ${k.pratinjau.metaJudul}`
      : k.pratinjau.metaTidakBerlaku,
    // Bukan sekadar sopan santun perayap: satu tautan pratinjau yang terindeks
    // menjadikannya publik selamanya, jauh setelah kedaluwarsanya lewat.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function HalamanPratinjau({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const [pratinjau, k, b] = await Promise.all([muatPratinjau(token), kamus(), bahasaAktif()]);

  // Token tidak dikenal, sudah dicabut, dan sudah kedaluwarsa menghasilkan
  // halaman yang SAMA: membedakannya berarti memberi tahu bahwa sebuah token
  // pernah ada.
  if (!pratinjau) notFound();

  const dok = pratinjau.dokumen;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      {/*
        Pita draf, dan ia sengaja di paling atas serta tanpa tombol tutup:
        pembaca halaman ini tidak punya cara lain mengetahui bahwa yang
        dibacanya belum disahkan siapa pun.
      */}
      <div className="flex items-start gap-3 rounded-lg border-l-2 border-l-warning bg-warning/10 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <div className="min-w-0">
          <p className="font-semibold tracking-wide text-warning-foreground">
            {k.pratinjau.pita}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{k.pratinjau.pitaKeterangan}</p>
        </div>
      </div>

      <header className="space-y-2">
        <p className="label-teknis text-muted-foreground/80">
          {pratinjau.prodi.kode} · {pratinjau.tahunAkademik.replace("-", " ")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-pretty">
          {pratinjau.mk.kode} — {namaMk(pratinjau.mk, b)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ringkasSks(dok.mataKuliah)}
        </p>
        {pratinjau.catatan ? (
          <p className="text-sm text-muted-foreground">{pratinjau.catatan}</p>
        ) : null}
      </header>

      <div className="min-w-0 space-y-12">
        <Bagian
          id="deskripsi"
          judul={k.dokumenPublik.bagian.deskripsiJudul}
          keterangan={k.dokumenPublik.bagian.deskripsiKeterangan}
        >
          <BagianDeskripsi dok={dok} />
        </Bagian>

        <Bagian id="capaian" judul={k.dokumenPublik.bagian.capaianJudul}>
          <BagianCapaian dok={dok} />
        </Bagian>

        <Bagian id="mingguan" judul={k.dokumenPublik.bagian.mingguanJudul}>
          <BagianMingguan dok={dok} />
        </Bagian>

        {dok.tugas.length > 0 ? (
          <Bagian id="tugas" judul={k.dokumenPublik.bagian.tugasJudul}>
            <BagianTugas dok={dok} />
          </Bagian>
        ) : null}

        <Bagian id="penilaian" judul={k.dokumenPublik.bagian.penilaianJudul}>
          <BagianPenilaian dok={dok} />
        </Bagian>

        <Bagian id="pustaka" judul={k.dokumenPublik.bagian.pustakaJudul}>
          <BagianPustaka dok={dok} />
        </Bagian>

        <Bagian id="pengampu" judul={k.dokumenPublik.bagian.pengampuJudul}>
          <BagianPengampu dok={dok} />
        </Bagian>
      </div>

      <footer className="border-t pt-6 text-xs text-muted-foreground">
        {isi(k.pratinjau.kedaluwarsa, { tanggal: tanggal(pratinjau.kedaluwarsa, b, "panjang") })}
      </footer>
    </div>
  );
}
