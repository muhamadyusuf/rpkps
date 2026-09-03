"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { pilihTeks } from "@/lib/bahasa/teks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TombolIkon } from "@/components/tombol-ikon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HasilSimpan } from "../aksi";
import {
  hapusProfilLulusan,
  perbaruiProfilLulusan,
  setelCplProfilLulusan,
  tambahProfilLulusan,
} from "../aksi-profil";

export type ProfilTampil = {
  id: string;
  kode: string;
  deskripsi: string;
  deskripsiEn: string | null;
  cplId: string[];
};

export type CplRingkas = {
  id: string;
  kode: string;
  deskripsi: string;
  deskripsiEn: string | null;
};

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<HasilSimpan>, sesudah?: () => void) =>
    mulai(async () => {
      const h = await fn();
      if (h.ok) {
        toast.success(h.pesan);
        sesudah?.();
        router.refresh();
      } else {
        toast.error(h.pesan);
      }
    });
  return { menunggu, jalankan };
}

/**
 * Penyunting profil lulusan beserta pemetaannya ke CPL.
 *
 * Dipasang di halaman kurikulum, bukan halaman tersendiri: profil lulusan hanya
 * bermakna berdampingan dengan daftar CPL yang menopangnya, dan Kaprodi perlu
 * melihat keduanya sekaligus saat memetakan.
 */
export function PengelolaProfilLulusan({
  kurikulumId,
  profil,
  cpl,
}: {
  kurikulumId: string;
  profil: ProfilTampil[];
  cpl: CplRingkas[];
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi, bahasa } = useBahasa();
  const [menyunting, setMenyunting] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {profil.map((p) =>
        menyunting === p.id ? (
          <FormulirProfil
            key={p.id}
            awal={p}
            menunggu={menunggu}
            onBatal={() => setMenyunting(null)}
            onSimpan={(kode, deskripsi, deskripsiEn) =>
              jalankan(
                () => perbaruiProfilLulusan(p.id, kode, deskripsi, deskripsiEn),
                () => setMenyunting(null),
              )
            }
          />
        ) : (
          <div key={p.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Badge variant="secondary">{p.kode}</Badge>
              <div className="flex gap-0.5">
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.profil.sunting, { kode: p.kode })}
                  disabled={menunggu}
                  onClick={() => setMenyunting(p.id)}
                >
                  <Pencil />
                </TombolIkon>
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.profil.hapus, { kode: p.kode })}
                  disabled={menunggu}
                  onClick={() => jalankan(() => hapusProfilLulusan(p.id))}
                >
                  <Trash2 />
                </TombolIkon>
              </div>
            </div>

            <p className="mt-1.5 text-sm">
              {pilihTeks(p.deskripsi, p.deskripsiEn, bahasa).teks}
            </p>

            {/* `key` dari isi pemetaan, bukan dari id profil: pilihan
                ditahan di state komponen, jadi ia harus dipasang ulang bila
                data di server berubah — mis. sesudah pengguna lain menyunting
                dan router.refresh() membawa nilai baru. */}
            <PemetaanCpl
              key={p.cplId.join(",")}
              profil={p}
              cpl={cpl}
              menunggu={menunggu}
              onSimpan={(dipilih) =>
                jalankan(() => setelCplProfilLulusan(p.id, dipilih))
              }
            />
          </div>
        ),
      )}

      {profil.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {k.kurikulum.profil.kosong}
        </p>
      ) : null}

      <FormulirProfil
        baru
        menunggu={menunggu}
        onSimpan={(kode, deskripsi, deskripsiEn, reset) =>
          jalankan(
            () => tambahProfilLulusan(kurikulumId, kode, deskripsi, deskripsiEn),
            reset,
          )
        }
      />
    </div>
  );
}

/**
 * Pemetaan CPL sebagai deretan tombol-jungkit, bukan Select bertingkat.
 *
 * Jumlah CPL satu kurikulum kecil (umumnya di bawah 12) dan pemilihannya jamak,
 * jadi menampilkan semuanya sekaligus lebih cepat dibaca daripada daftar yang
 * harus dibuka satu per satu. Perubahan ditahan sampai "Simpan pemetaan"
 * ditekan supaya mencentang empat CPL tidak berarti empat kali tulis.
 */
function PemetaanCpl({
  profil,
  cpl,
  menunggu,
  onSimpan,
}: {
  profil: ProfilTampil;
  cpl: CplRingkas[];
  menunggu: boolean;
  onSimpan: (cplId: string[]) => void;
}) {
  const { k, bahasa } = useBahasa();
  const [dipilih, setDipilih] = useState<string[]>(profil.cplId);

  const berubah =
    dipilih.length !== profil.cplId.length ||
    dipilih.some((id) => !profil.cplId.includes(id));

  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {k.kurikulum.profil.cplPenopang}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {cpl.map((c) => {
          const aktif = dipilih.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={aktif}
              title={pilihTeks(c.deskripsi, c.deskripsiEn, bahasa).teks}
              disabled={menunggu}
              onClick={() =>
                setDipilih((s) =>
                  s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                )
              }
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors duration-200 ease-presisi",
                "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                aktif
                  ? "border-cahaya/45 bg-cahaya/12 text-foreground"
                  : "border-border text-muted-foreground hover:border-cahaya/30 hover:text-foreground",
              )}
            >
              {c.kode}
            </button>
          );
        })}
        {cpl.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            {k.kurikulum.profil.tanpaCpl}
          </span>
        ) : null}
      </div>

      {berubah ? (
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" disabled={menunggu} onClick={() => onSimpan(dipilih)}>
            <Check />
            {k.kurikulum.profil.simpanPemetaan}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={menunggu}
            onClick={() => setDipilih(profil.cplId)}
          >
            {k.kurikulum.profil.batal}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FormulirProfil({
  awal,
  baru = false,
  menunggu,
  onSimpan,
  onBatal,
}: {
  awal?: { kode: string; deskripsi: string; deskripsiEn: string | null };
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (
    kode: string,
    deskripsi: string,
    deskripsiEn: string | null,
    reset: () => void,
  ) => void;
  onBatal?: () => void;
}) {
  const { k, isi: isiTeks } = useBahasa();
  const idForm = baru ? "form-profil-baru" : undefined;

  return (
    <form
      id={idForm}
      className={cn(
        "flex flex-wrap items-end gap-2",
        baru ? "border-t pt-4" : "rounded-lg border border-cahaya/40 p-4",
      )}
      action={(fd) => {
        const kode = String(fd.get("kode") ?? "");
        const deskripsi = String(fd.get("deskripsi") ?? "");
        const deskripsiEn = String(fd.get("deskripsiEn") ?? "").trim() || null;
        onSimpan(kode, deskripsi, deskripsiEn, () => {
          if (!idForm) return;
          const form = document.getElementById(idForm) as HTMLFormElement | null;
          form?.reset();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${idForm ?? awal?.kode}-kode`}>{k.kurikulum.profil.kode}</Label>
        <Input
          id={`${idForm ?? awal?.kode}-kode`}
          name="kode"
          defaultValue={awal?.kode ?? ""}
          placeholder={k.kurikulum.profil.contohKode}
          className="w-24 font-mono"
          required
        />
      </div>

      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor={`${idForm ?? awal?.kode}-deskripsi`}>
          {k.kurikulum.profil.deskripsi}
        </Label>
        <Input
          id={`${idForm ?? awal?.kode}-deskripsi`}
          name="deskripsi"
          defaultValue={awal?.deskripsi ?? ""}
          placeholder={k.kurikulum.profil.contohDeskripsi}
          required
        />
      </div>

      {/* Terjemahan tampilan; selalu opsional, tidak pernah menghalangi simpan. */}
      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor={`${idForm ?? awal?.kode}-deskripsiEn`}>
          {isiTeks(k.dwibahasa.labelEn, { label: k.kurikulum.profil.deskripsi })}
        </Label>
        <Input
          id={`${idForm ?? awal?.kode}-deskripsiEn`}
          name="deskripsiEn"
          defaultValue={awal?.deskripsiEn ?? ""}
          placeholder={k.dwibahasa.belumDiterjemahkan}
        />
      </div>

      <Button type="submit" variant={baru ? "outline" : "default"} disabled={menunggu}>
        {baru ? <Plus /> : <Check />}
        {baru ? k.kurikulum.profil.tambah : k.kurikulum.profil.simpan}
      </Button>

      {onBatal ? (
        <Button type="button" variant="ghost" disabled={menunggu} onClick={onBatal}>
          <X />
          {k.umum.batal}
        </Button>
      ) : null}
    </form>
  );
}
