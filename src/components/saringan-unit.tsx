"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Tautan } from "@/components/tautan";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pilihan } from "@/components/ui/pilihan";
import type { SaringanUnit as NilaiSaringan, UnitTersedia } from "@/lib/unit";
import { cn } from "@/lib/utils";

/**
 * Penyaring daftar menurut fakultas dan program studi.
 *
 * Formulir GET biasa, sama seperti penyaring katalog publik: hasilnya masuk ke
 * alamat, sehingga sebuah saringan dapat ditempelkan ke pesan dan dibuka orang
 * lain apa adanya. `hal` sengaja TIDAK dibawa serta — saringan baru selalu
 * mulai dari halaman pertama, karena nomor halaman lama tidak berarti apa-apa
 * pada kumpulan hasil yang berbeda.
 *
 * Ini komponen klien, tidak seperti penyaring katalog, karena satu hal yang
 * tidak dapat dikerjakan `<select>` bawaan sendirian: memilih fakultas harus
 * MEMPERSEMPIT daftar prodi. Tanpa itu, ADMIN sebuah institusi bermultifakultas
 * memilih "Fakultas Ilmu Komputer" lalu tetap harus mencari prodinya di antara
 * seluruh prodi institusi.
 *
 * Pilihan yang tinggal satu disembunyikan, bukan dinonaktifkan: bagi Kaprodi
 * yang hanya memegang satu prodi, sebuah kotak pilih berisi satu butir adalah
 * pertanyaan yang jawabannya sudah pasti.
 */
export function SaringanUnit({
  action,
  unit,
  nilai,
  denganCari = false,
  placeholderCari,
  className,
}: {
  /** Alamat tujuan, ditulis TANPA awalan bahasa — mis. "/kurikulum". */
  action: string;
  unit: UnitTersedia;
  nilai: NilaiSaringan & { q?: string };
  denganCari?: boolean;
  placeholderCari?: string;
  className?: string;
}) {
  const { k, jalur } = useBahasa();

  const adaFakultas = unit.fakultas.length > 1;
  const adaProdi = unit.prodi.length > 1;

  const [fakultas, setFakultas] = useState(nilai.fakultas ?? "");
  const [prodi, setProdi] = useState(nilai.prodi ?? "");

  if (!adaFakultas && !adaProdi && !denganCari) return null;

  const pilihanProdi = fakultas
    ? unit.prodi.filter((p) => p.fakultas === fakultas)
    : unit.prodi;

  const adaSaringan = Boolean(nilai.q || nilai.fakultas || nilai.prodi);

  return (
    <form
      action={jalur(action)}
      className={cn("flex flex-wrap items-end gap-3", className)}
    >
      {denganCari ? (
        <div className="min-w-56 flex-1">
          <Label htmlFor="saringan-q">{k.komponen.saringanUnit.cari}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="saringan-q"
              type="search"
              name="q"
              defaultValue={nilai.q ?? ""}
              placeholder={placeholderCari}
              aria-label={k.komponen.cari.aria}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}

      {adaFakultas ? (
        <div className="min-w-48">
          <Label htmlFor="saringan-fakultas">{k.komponen.saringanUnit.fakultas}</Label>
          <Pilihan
            id="saringan-fakultas"
            nama="fakultas"
            nilai={fakultas}
            onChange={(baru) => {
              setFakultas(baru);
              // Prodi yang sudah dipilih bisa jadi milik fakultas lain;
              // membiarkannya membuat saringan yang tidak pernah ada hasilnya.
              setProdi("");
            }}
          >
            <option value="">{k.komponen.saringanUnit.semuaFakultas}</option>
            {unit.fakultas.map((f) => (
              <option key={f.kode} value={f.kode}>
                {f.nama}
              </option>
            ))}
          </Pilihan>
        </div>
      ) : null}

      {adaProdi ? (
        <div className="min-w-48">
          <Label htmlFor="saringan-prodi">{k.komponen.saringanUnit.prodi}</Label>
          <Pilihan
            id="saringan-prodi"
            nama="prodi"
            nilai={prodi}
            onChange={setProdi}
          >
            <option value="">{k.komponen.saringanUnit.semuaProdi}</option>
            {pilihanProdi.map((p) => (
              <option key={p.kode} value={p.kode}>
                {p.nama}
              </option>
            ))}
          </Pilihan>
        </div>
      ) : null}

      <Button type="submit" variant="outline">
        <SlidersHorizontal />
        {k.komponen.saringanUnit.terapkan}
      </Button>

      {adaSaringan ? (
        <Tautan
          href={action}
          className="pb-2 text-sm text-muted-foreground underline underline-offset-4"
        >
          {k.komponen.cari.bersihkan}
        </Tautan>
      ) : null}
    </form>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="label-teknis mb-1.5 block text-muted-foreground/80">
      {children}
    </label>
  );
}
