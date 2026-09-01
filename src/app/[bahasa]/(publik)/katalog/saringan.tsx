import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelTahunAkademik } from "@/domain/rpkps/publik";
import type { ProdiPublik } from "@/lib/publik/muat";
import { cn } from "@/lib/utils";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";

/**
 * Penyaring katalog sebagai formulir GET biasa.
 *
 * Sengaja memakai `<select>` bawaan peramban, bukan komponen Select milik Base
 * UI: halaman ini harus bekerja tanpa JavaScript, dan hasil penyaringannya
 * harus bisa disalin sebagai tautan — persis yang dibutuhkan situs prodi saat
 * menautkan "mata kuliah semester 3".
 *
 * `action` menentukan ke mana hasil dikirim: `/katalog` untuk katalog lintas
 * prodi, `/katalog/{kode}` bila prodinya sudah ditentukan alamat.
 */
export async function PapanSaringan({
  action,
  daftarProdi,
  daftarTahunAkademik,
  nilai,
}: {
  action: string;
  /** Kosong berarti prodi sudah ditentukan alamat — pilihannya disembunyikan. */
  daftarProdi: ProdiPublik[];
  daftarTahunAkademik: { kode: string }[];
  nilai: { cari?: string; prodi?: string; ta?: string; semester?: string };
}) {
  const k = await kamus();

  return (
    <form
      action={action}
      className="panel rounded-xl border bg-card p-3 md:p-4 print:hidden"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="cari">{k.publikHalaman.saringan.cari}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cari"
              type="search"
              name="cari"
              defaultValue={nilai.cari ?? ""}
              placeholder={k.publikHalaman.saringan.cariPlaceholder}
              className="pl-9"
            />
          </div>
        </div>

        {daftarProdi.length > 0 ? (
          <div className="min-w-44">
            <Label htmlFor="prodi">{k.publikHalaman.saringan.prodi}</Label>
            <Pilihan id="prodi" nama="prodi" nilai={nilai.prodi}>
              <option value="">{k.publikHalaman.saringan.semuaProdi}</option>
              {daftarProdi.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.nama}
                </option>
              ))}
            </Pilihan>
          </div>
        ) : null}

        <div className="min-w-40">
          <Label htmlFor="ta">{k.publikHalaman.saringan.tahunAkademik}</Label>
          <Pilihan id="ta" nama="ta" nilai={nilai.ta}>
            <option value="">{k.publikHalaman.saringan.semuaTahun}</option>
            {daftarTahunAkademik.map((t) => (
              <option key={t.kode} value={t.kode}>
                {labelTahunAkademik(t.kode)}
              </option>
            ))}
          </Pilihan>
        </div>

        <div className="min-w-32">
          <Label htmlFor="semester">{k.publikHalaman.saringan.semester}</Label>
          <Pilihan id="semester" nama="semester" nilai={nilai.semester}>
            <option value="">{k.publikHalaman.saringan.semuaSemester}</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={String(s)}>
                {isi(k.publikHalaman.saringan.semesterKe, { nomor: s })}
              </option>
            ))}
          </Pilihan>
        </div>

        <Button type="submit" variant="outline">
          <SlidersHorizontal />
          {k.publikHalaman.saringan.terapkan}
        </Button>
      </div>
    </form>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="label-teknis mb-1.5 block text-muted-foreground/80"
    >
      {children}
    </label>
  );
}

/**
 * `<select>` bawaan yang disamakan tampilannya dengan Input — termasuk panah
 * yang digambar sendiri, karena `appearance-none` menghapus panah asli.
 */
function Pilihan({
  id,
  nama,
  nilai,
  children,
}: {
  id: string;
  nama: string;
  nilai?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={nama}
        defaultValue={nilai ?? ""}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-card py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,border-color] duration-200 outline-none",
          "hover:border-cahaya/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
          "dark:bg-input/30",
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute top-1/2 right-3 h-1.5 w-2.5 -translate-y-1/2 text-muted-foreground"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
