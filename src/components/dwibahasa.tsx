"use client";

/**
 * Medan isian dwibahasa untuk penyunting isi RPKPS.
 *
 * Mode kerja yang sesungguhnya adalah "Berdampingan": teks Indonesia di kiri
 * sebagai acuan, isian Inggris di kanan. Menerjemahkan tanpa melihat aslinya
 * adalah cara paling cepat menghasilkan terjemahan yang salah (docs/11 §5.5).
 *
 * Mode hanya mengatur apa yang TAMPIL. Muatan simpan selalu membawa kedua
 * bahasa sekaligus: penyimpanan mengganti seluruh isi baris, jadi mengirim
 * satu bahasa saja akan menghapus bahasa yang lain tanpa satu pesan pun
 * (docs/11 §5.3).
 */

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks } from "@/components/ui/pilihan";
import { TombolIkon } from "@/components/tombol-ikon";
import { useBahasa } from "@/components/penyedia-bahasa";

export type ModeBahasa = "id" | "en" | "damping";

/** Sakelar mode. Ditaruh sekali di kepala penyunting. */
export function SakelarBahasa({
  mode,
  ubah,
}: {
  mode: ModeBahasa;
  ubah: (m: ModeBahasa) => void;
}) {
  const { k } = useBahasa();
  const pilihan: { nilai: ModeBahasa; label: string }[] = [
    { nilai: "id", label: k.dwibahasa.modeId },
    { nilai: "en", label: k.dwibahasa.modeEn },
    { nilai: "damping", label: k.dwibahasa.modeDamping },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {k.dwibahasa.mode}
      </span>
      <div className="inline-flex rounded-lg border p-0.5">
        {pilihan.map((p) => (
          <button
            key={p.nilai}
            type="button"
            onClick={() => ubah(p.nilai)}
            aria-pressed={mode === p.nilai}
            className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
              mode === p.nilai
                ? "bg-cahaya/15 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {mode === "damping" ? (
        <span className="text-xs text-muted-foreground">{k.dwibahasa.petunjukDamping}</span>
      ) : null}
    </div>
  );
}

/** Kerangka satu atau dua kolom menurut mode. */
function Kerangka({
  mode,
  kiri,
  kanan,
}: {
  mode: ModeBahasa;
  kiri: React.ReactNode;
  kanan: React.ReactNode;
}) {
  if (mode === "id") return <>{kiri}</>;
  if (mode === "en") return <>{kanan}</>;
  return <div className="grid gap-3 md:grid-cols-2 md:items-start">{kiri}{kanan}</div>;
}

interface PropsMedan {
  mode: ModeBahasa;
  id: string;
  label: string;
  nilai: string;
  nilaiEn: string;
  ubah: (v: string) => void;
  ubahEn: (v: string) => void;
  petunjuk?: string;
  /** Bila diisi, medan menjadi textarea setinggi sekian baris. */
  baris?: number;
}

export function Medan({
  mode,
  id,
  label,
  nilai,
  nilaiEn,
  ubah,
  ubahEn,
  petunjuk,
  baris,
}: PropsMedan) {
  const { k, isi } = useBahasa();

  const kotak = (
    idn: string,
    v: string,
    onUbah: (x: string) => void,
    labelnya: string,
    ph?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={idn}>{labelnya}</Label>
      {baris ? (
        <textarea
          id={idn}
          rows={baris}
          value={v}
          placeholder={ph}
          onChange={(e) => onUbah(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <Input id={idn} value={v} placeholder={ph} onChange={(e) => onUbah(e.target.value)} />
      )}
    </div>
  );

  return (
    <Kerangka
      mode={mode}
      kiri={kotak(id, nilai, ubah, label, petunjuk)}
      kanan={kotak(`${id}En`, nilaiEn, ubahEn, isi(k.dwibahasa.labelEn, { label }))}
    />
  );
}

/**
 * Daftar teks berpasangan.
 *
 * Kedua bahasa dipasangkan MENURUT URUTAN, dan barisnya ditambah/dihapus
 * bersama-sama. Membiarkan panjangnya berbeda akan membuat subtopik ketiga
 * berbahasa Inggris menjelaskan subtopik keempat berbahasa Indonesia.
 */
export function DaftarDwibahasa({
  mode,
  label,
  nilai,
  nilaiEn,
  ubah,
  ubahEn,
  petunjuk,
}: {
  mode: ModeBahasa;
  label: string;
  nilai: string[];
  nilaiEn: string[];
  ubah: (v: string[]) => void;
  ubahEn: (v: string[]) => void;
  petunjuk?: string;
}) {
  const { k, isi } = useBahasa();
  const jumlah = Math.max(nilai.length, nilaiEn.length);
  const pada = (a: string[], i: number) => a[i] ?? "";

  const setBaris = (i: number, v: string, en: boolean) => {
    const dasar = en ? nilaiEn : nilai;
    const baru = Array.from({ length: jumlah }, (_, j) => (j === i ? v : pada(dasar, j)));
    (en ? ubahEn : ubah)(baru);
  };

  const hapus = (i: number) => {
    ubah(nilai.filter((_, j) => j !== i));
    ubahEn(nilaiEn.filter((_, j) => j !== i));
  };

  const tambah = () => {
    ubah([...Array.from({ length: jumlah }, (_, j) => pada(nilai, j)), ""]);
    ubahEn([...Array.from({ length: jumlah }, (_, j) => pada(nilaiEn, j)), ""]);
  };

  return (
    <div className="space-y-2">
      <Label>{mode === "en" ? isi(k.dwibahasa.labelEn, { label }) : label}</Label>
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <div className="min-w-0 flex-1">
            <Kerangka
              mode={mode}
              kiri={
                <Input
                  value={pada(nilai, i)}
                  placeholder={petunjuk}
                  onChange={(e) => setBaris(i, e.target.value, false)}
                />
              }
              kanan={
                <Input
                  value={pada(nilaiEn, i)}
                  placeholder={k.dwibahasa.belumDiterjemahkan}
                  onChange={(e) => setBaris(i, e.target.value, true)}
                />
              }
            />
          </div>
          <TombolIkon
            petunjuk={isi(k.rpkps.mingguEditor.hapusButir, { label: label.toLowerCase() })}
            onClick={() => hapus(i)}
          >
            <Trash2 />
          </TombolIkon>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={tambah}>
        <Plus />
        {isi(k.rpkps.mingguEditor.tambahButir, { label: label.toLowerCase() })}
      </Button>
    </div>
  );
}

/** Bentuk pasangan untuk daftar yang barisnya memang satu baris tabel. */
export interface Pasangan {
  teks: string;
  teksEn: string | null;
}

/** `DaftarDwibahasa` untuk daftar berbentuk `{ teks, teksEn }[]`. */
export function DaftarPasangan({
  mode,
  label,
  nilai,
  ubah,
  petunjuk,
}: {
  mode: ModeBahasa;
  label: string;
  nilai: Pasangan[];
  ubah: (v: Pasangan[]) => void;
  petunjuk?: string;
}) {
  return (
    <DaftarDwibahasa
      mode={mode}
      label={label}
      petunjuk={petunjuk}
      nilai={nilai.map((x) => x.teks)}
      nilaiEn={nilai.map((x) => x.teksEn ?? "")}
      ubah={(v) => ubah(v.map((teks, i) => ({ teks, teksEn: nilai[i]?.teksEn ?? null })))}
      ubahEn={(v) => ubah(v.map((teksEn, i) => ({ teks: nilai[i]?.teks ?? "", teksEn })))}
    />
  );
}


/**
 * Pasangan area teks untuk borang berbasis `FormData` — lapisan kurikulum.
 *
 * Beda bentuk dari `Medan` di atas, sama maksudnya. Borang kurikulum tidak
 * menahan isinya di state: nilainya dibaca dari `FormData` saat submit. Jadi
 * pasangannya cukup dua area teks tak terkendali yang berdampingan, dan
 * keduanya SELALU ikut satu muatan simpan — aksi kurikulum menulis seluruh
 * `parsed.data`, sehingga medan yang tidak dikirim akan terhapus tanpa satu
 * pesan pun (docs/11 §5.3).
 *
 * Medan Inggrisnya bernama `${nama}En`, mengikuti nama kolomnya di skema.
 */
export function AreaTeksDwibahasa({
  id,
  nama,
  label,
  nilai,
  nilaiEn,
  petunjuk,
  baris,
}: {
  /** Awalan id borang; medan Inggris memakai `${id}-${nama}En`. */
  id: string;
  nama: string;
  label: string;
  nilai: string;
  nilaiEn: string;
  petunjuk?: string;
  baris?: number;
}) {
  const { k, isi } = useBahasa();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-${nama}`}>{label}</Label>
        <AreaTeks
          id={`${id}-${nama}`}
          nama={nama}
          nilai={nilai}
          baris={baris}
          placeholder={petunjuk}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-${nama}En`}>{isi(k.dwibahasa.labelEn, { label })}</Label>
        <AreaTeks
          id={`${id}-${nama}En`}
          nama={`${nama}En`}
          nilai={nilaiEn}
          baris={baris}
          placeholder={k.dwibahasa.belumDiterjemahkan}
        />
      </div>
    </div>
  );
}
