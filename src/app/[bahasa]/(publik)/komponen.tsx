import { Tautan } from "@/components/tautan";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { labelTahunAkademik, ringkasSks } from "@/domain/rpkps/publik";
import type { ButirKatalog } from "@/lib/publik/muat";
import { jalurRpkpsPublik } from "@/lib/publik/tautan";
import { cn } from "@/lib/utils";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import gaya from "./katalog.module.css";

/** Kartu angka: label teknis di atas, angka tabular besar di bawah. */
export function KartuAngka({
  label,
  nilai,
  keterangan,
  className,
}: {
  label: string;
  nilai: number | string;
  keterangan?: string;
  className?: string;
}) {
  return (
    <div className={cn(gaya.angka, className)}>
      <p className="label-teknis text-muted-foreground">{label}</p>
      <p className={gaya.angkaNilai}>{nilai}</p>
      {keterangan ? (
        <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>
      ) : null}
    </div>
  );
}

/**
 * Kartu satu mata kuliah di katalog.
 *
 * Kode mata kuliah tetap mudah dipindai di atas nama, dengan metadata di kaki
 * kartu. Seluruh kartu adalah satu target tautan supaya mudah disentuh di ponsel.
 */
export async function KartuMataKuliah({ butir }: { butir: ButirKatalog }) {
  const [k, b] = await Promise.all([kamus(), bahasaAktif()]);

  return (
    <Tautan
      href={jalurRpkpsPublik(butir.prodiKode, butir.kode)}
      className={gaya.kartu}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={gaya.kodeMk}>{butir.kode}</span>
        <span className={gaya.semesterKartu}>
          {isi(k.publikHalaman.kartu.sem, { nomor: butir.semester })}
        </span>
      </div>

      <h3 className={gaya.namaMk}>
        {namaMk(butir, b)}
      </h3>

      <dl className={gaya.metadataMk}>
        <div className="flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.beban}</dt>
          <dd className="font-mono tabular-nums">{ringkasSks(butir)}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.jumlahCpmk}</dt>
          <dd className="font-mono tabular-nums">
            {isi(k.publikHalaman.kartu.cpmk, { jumlah: butir.jumlahCpmk })}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.tahunAkademik}</dt>
          <dd className="font-mono text-[11px] tabular-nums">
            {labelTahunAkademik(butir.tahunAkademik)}
          </dd>
        </div>
      </dl>
      <ArrowUpRight aria-hidden className={gaya.panahKartu} />
    </Tautan>
  );
}

/**
 * Katalog dikelompokkan per semester — urutan yang dipakai mahasiswa saat
 * menyusun rencana studi, bukan urutan abjad.
 */
export async function KatalogPerSemester({ butir }: { butir: ButirKatalog[] }) {
  const k = await kamus();

  if (butir.length === 0) {
    return (
      <div className={gaya.kosong}>
        <BookOpen aria-hidden className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-heading text-base font-semibold">
          {k.publikHalaman.kartu.kosongJudul}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {k.publikHalaman.kartu.kosongIsi}
        </p>
      </div>
    );
  }

  const semester = [...new Set(butir.map((b) => b.semester))].sort((a, b) => a - b);

  return (
    <div className={gaya.daftarSemester}>
      {semester.map((s) => {
        const perSemester = butir.filter((b) => b.semester === s);
        return (
          <section key={s} className={gaya.kelompokSemester}>
            <div className={gaya.kepalaSemester}>
              <span aria-hidden className={gaya.nomorSemester}>
                {String(s).padStart(2, "0")}
              </span>
              <h2 className="label-teknis text-muted-foreground">
                {isi(k.publikHalaman.kartu.semesterJudul, { nomor: s })}
              </h2>
              <p className={gaya.jumlahSemester}>
                {isi(k.katalog.jumlahMk, { jumlah: perSemester.length })}
              </p>
            </div>
            <div className={gaya.gridMk}>
              {perSemester.map((b) => (
                <KartuMataKuliah key={`${b.prodiKode}-${b.kode}`} butir={b} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
