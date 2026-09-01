import { Tautan } from "@/components/tautan";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { labelTahunAkademik, ringkasSks } from "@/domain/rpkps/publik";
import type { ButirKatalog } from "@/lib/publik/muat";
import { jalurRpkpsPublik } from "@/lib/publik/tautan";
import { cn } from "@/lib/utils";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { pilihTeks } from "@/lib/bahasa/teks";

/** Kartu angka: label teknis di atas, angka monospace besar di bawah. */
export function KartuAngka({
  label,
  nilai,
  keterangan,
}: {
  label: string;
  nilai: number | string;
  keterangan?: string;
}) {
  return (
    <div className="panel rounded-xl border bg-card p-4">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{nilai}</p>
      {keterangan ? (
        <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>
      ) : null}
    </div>
  );
}

/**
 * Kartu satu mata kuliah di katalog.
 *
 * Kode mata kuliah dijadikan penanda utama — monospace, ukuran penuh — karena
 * itulah yang dicari orang saat datang dari jadwal kuliah. Nama menyusul di
 * bawahnya. Seluruh kartu adalah satu target tautan supaya mudah disentuh di
 * ponsel.
 */
export async function KartuMataKuliah({ butir }: { butir: ButirKatalog }) {
  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <Tautan
      href={jalurRpkpsPublik(butir.prodiKode, butir.kode)}
      className={cn(
        "panel group/kartu relative flex flex-col rounded-xl border bg-card p-4 transition-all duration-200 ease-presisi",
        "hover:-translate-y-0.5 hover:border-cahaya/40 hover:shadow-angkat",
        "focus-visible:border-cahaya/50 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-sm font-semibold tracking-tight text-cahaya">
          {butir.kode}
        </span>
        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
          {isi(k.publikHalaman.kartu.sem, { nomor: butir.semester })}
        </Badge>
      </div>

      <h3 className="mt-1.5 font-heading text-base leading-snug font-semibold text-balance">
        {pilihTeks(butir.nama, butir.namaEn, b).teks}
      </h3>

      <dl className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.beban}</dt>
          <dd className="font-mono tabular-nums">{ringkasSks(butir)}</dd>
        </div>
        <span aria-hidden className="text-border">·</span>
        <div className="flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.jumlahCpmk}</dt>
          <dd className="font-mono tabular-nums">
            {isi(k.publikHalaman.kartu.cpmk, { jumlah: butir.jumlahCpmk })}
          </dd>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <dt className="sr-only">{k.publikHalaman.kartu.tahunAkademik}</dt>
          <dd className="font-mono text-[11px] tabular-nums">
            {labelTahunAkademik(butir.tahunAkademik)}
          </dd>
        </div>
      </dl>
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
      <div className="panel rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
        <BookOpen className="mx-auto size-6 text-muted-foreground/60" />
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
    <div className="space-y-8">
      {semester.map((s) => {
        const perSemester = butir.filter((b) => b.semester === s);
        return (
          <section key={s}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="label-teknis text-muted-foreground/80">
                {isi(k.publikHalaman.kartu.semesterJudul, { nomor: s })}
              </h2>
              <span aria-hidden className="h-px flex-1 bg-border" />
              <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
                {perSemester.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

