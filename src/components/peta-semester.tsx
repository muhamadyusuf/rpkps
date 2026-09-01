import type { ReactNode } from "react";
import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { cn } from "@/lib/utils";

/**
 * Peta kurikulum: mata kuliah dikelompokkan per semester, dua kolom, dengan
 * subtotal sks tiap semester dan rekapitulasi di kaki halaman.
 *
 * Bentuknya sengaja meniru lembar struktur kurikulum yang sudah dipakai prodi
 * — kolom Kode MK, Nama MK, dan sks yang dipecah TEO/PRA, lalu "Jumlah SKS"
 * per semester. Itulah tampilan yang dibaca saat orang bertanya "semester 4
 * berapa sks?", pertanyaan yang tidak terjawab oleh satu tabel panjang berisi
 * lima puluh dua baris.
 *
 * Murni penampil: tidak menyentuh Prisma dan tidak tahu apa-apa soal RPKPS
 * maupun kurikulum. Yang berbeda antara keduanya dititipkan lewat `lencana`
 * dan `href` pada tiap baris, sehingga daftar RPKPS dapat memakai lembar yang
 * sama persis tanpa menyalin susunan tabelnya.
 */

export type BarisPeta = {
  id: string;
  kode: string;
  nama: string;
  semester: number;
  sksTeori: number;
  sksPraktik: number;
  /** Ditulis TANPA awalan bahasa — `Tautan` yang memasangnya. */
  href?: string;
  /** Penanda tambahan di sebelah nama: status RPKPS, sifat MK, dan sejenisnya. */
  lencana?: ReactNode;
};

export type KopPeta = {
  judul: string;
  baris: string[];
};

/**
 * Rona per semester. Satu semester satu warna, berulang setelah delapan —
 * program D3 pun tidak melampauinya, dan gelar ganda yang melampauinya lebih
 * baik mengulang warna daripada kehabisan.
 *
 * Nilainya rona (hue) mentah, bukan warna jadi: warnanya dirakit dengan
 * `color-mix` beralfa rendah di atas latar kartu, sehingga tetap terbaca pada
 * tema terang maupun gelap tanpa dua daftar warna yang harus dijaga selaras.
 */
const RONA = [210, 330, 145, 75, 295, 185, 35, 20];

function rona(semester: number): string {
  return `oklch(0.62 0.13 ${RONA[(Math.max(1, semester) - 1) % RONA.length]})`;
}

export async function PetaSemester({
  baris,
  kop,
  kosong,
  className,
}: {
  baris: BarisPeta[];
  kop?: KopPeta;
  /** Kalimat saat tidak ada satu pun baris. */
  kosong: string;
  className?: string;
}) {
  const k = await kamus();

  if (baris.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{kosong}</p>;
  }

  const semester = [...new Set(baris.map((b) => b.semester))].sort((a, b) => a - b);

  const totalTeori = baris.reduce((n, b) => n + b.sksTeori, 0);
  const totalPraktik = baris.reduce((n, b) => n + b.sksPraktik, 0);

  return (
    <div className={cn("space-y-5", className)}>
      {kop ? (
        <header className="text-center">
          <h2 className="font-heading text-base font-semibold tracking-tight uppercase">
            {kop.judul}
          </h2>
          {kop.baris.map((teks) => (
            <p key={teks} className="text-sm font-medium tracking-tight uppercase">
              {teks}
            </p>
          ))}
        </header>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        {semester.map((nomor) => (
          <PanelSemester
            key={nomor}
            nomor={nomor}
            baris={baris.filter((b) => b.semester === nomor)}
            k={k}
          />
        ))}
      </div>

      {/*
        Rekapitulasi diletakkan di kanan bawah, sejajar dengan panel semester
        terakhir — posisi yang sama dengan lembar cetaknya, supaya orang yang
        terbiasa membaca lembar itu tidak perlu mencarinya.
      */}
      <div className="flex justify-end">
        <table className="w-full max-w-xs overflow-hidden rounded-lg border text-sm">
          <tbody>
            <Rekap label={k.komponen.peta.totalMk} nilai={baris.length} />
            <Rekap label={k.komponen.peta.totalTeori} nilai={totalTeori} />
            <Rekap label={k.komponen.peta.totalPraktik} nilai={totalPraktik} />
            <Rekap
              label={k.komponen.peta.totalSks}
              nilai={totalTeori + totalPraktik}
              tebal
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rekap({
  label,
  nilai,
  tebal = false,
}: {
  label: string;
  nilai: number;
  tebal?: boolean;
}) {
  return (
    <tr className={cn("border-b last:border-0", tebal && "bg-muted/50")}>
      <th
        scope="row"
        className={cn(
          "px-3 py-1.5 text-right text-xs font-medium text-muted-foreground",
          tebal && "text-foreground",
        )}
      >
        {label}
      </th>
      <td
        className={cn(
          "w-16 border-l px-3 py-1.5 text-center tabular-nums",
          tebal && "font-semibold",
        )}
      >
        {nilai}
      </td>
    </tr>
  );
}

function PanelSemester({
  nomor,
  baris,
  k,
}: {
  nomor: number;
  baris: BarisPeta[];
  k: Awaited<ReturnType<typeof kamus>>;
}) {
  const teori = baris.reduce((n, b) => n + b.sksTeori, 0);
  const praktik = baris.reduce((n, b) => n + b.sksPraktik, 0);

  // Warnanya dirakit di sini, bukan lewat kelas Tailwind sewenang-wenang:
  // ronanya datang dari nomor semester saat render, dan kelas yang dirakit dari
  // nilai runtime tidak pernah ikut terpindai pemaket CSS.
  const warna = rona(nomor);

  return (
    <section className="panel overflow-hidden rounded-xl border bg-card">
      <h3
        className="label-teknis border-b px-3 py-2 text-center text-foreground"
        style={{
          backgroundColor: `color-mix(in oklab, ${warna} 14%, transparent)`,
          borderColor: `color-mix(in oklab, ${warna} 38%, transparent)`,
        }}
      >
        {isi(k.komponen.peta.semester, { nomor })}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th
                rowSpan={2}
                className="label-teknis w-10 border-r px-2 py-1.5 text-center text-muted-foreground"
              >
                {k.komponen.peta.no}
              </th>
              <th
                rowSpan={2}
                className="label-teknis border-r px-2 py-1.5 text-left text-muted-foreground"
              >
                {k.komponen.peta.kodeMk}
              </th>
              <th
                rowSpan={2}
                className="label-teknis border-r px-2 py-1.5 text-left text-muted-foreground"
              >
                {k.komponen.peta.namaMk}
              </th>
              <th
                colSpan={2}
                className="label-teknis border-b px-2 py-1 text-center text-muted-foreground"
              >
                {k.komponen.peta.sks}
              </th>
            </tr>
            <tr className="border-b">
              <th className="label-teknis w-12 border-r px-2 py-1 text-center text-muted-foreground">
                {k.komponen.peta.teori}
              </th>
              <th className="label-teknis w-12 px-2 py-1 text-center text-muted-foreground">
                {k.komponen.peta.praktik}
              </th>
            </tr>
          </thead>

          <tbody>
            {baris.map((b, i) => (
              <tr
                key={b.id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-cahaya/6"
              >
                <td className="border-r px-2 py-1.5 text-center text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="border-r px-2 py-1.5 font-mono text-xs whitespace-nowrap">
                  {b.href ? (
                    <Tautan
                      href={b.href}
                      className="underline-offset-4 hover:text-cahaya hover:underline"
                    >
                      {b.kode}
                    </Tautan>
                  ) : (
                    b.kode
                  )}
                </td>
                <td className="border-r px-2 py-1.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {b.href ? (
                      <Tautan href={b.href} className="underline-offset-4 hover:underline">
                        {b.nama}
                      </Tautan>
                    ) : (
                      b.nama
                    )}
                    {b.lencana}
                  </span>
                </td>
                <td className="border-r px-2 py-1.5 text-center tabular-nums">
                  {b.sksTeori}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">{b.sksPraktik}</td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-muted/40">
            <tr className="border-t">
              <th
                colSpan={3}
                scope="row"
                className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground"
              >
                {k.komponen.peta.jumlahSks}
              </th>
              <td className="border-l px-2 py-1.5 text-center font-medium tabular-nums">
                {teori}
              </td>
              <td className="border-l px-2 py-1.5 text-center font-medium tabular-nums">
                {praktik}
              </td>
            </tr>
            <tr className="border-t">
              <th
                colSpan={3}
                scope="row"
                className="px-2 py-1.5 text-right text-xs font-medium"
              >
                {isi(k.komponen.peta.jumlahSksSemester, { nomor })}
              </th>
              <td
                colSpan={2}
                className="border-l px-2 py-1.5 text-center font-semibold tabular-nums"
              >
                {teori + praktik}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
