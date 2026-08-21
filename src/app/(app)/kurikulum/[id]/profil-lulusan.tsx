"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  cplId: string[];
};

export type CplRingkas = { id: string; kode: string; deskripsi: string };

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
            onSimpan={(kode, deskripsi) =>
              jalankan(
                () => perbaruiProfilLulusan(p.id, kode, deskripsi),
                () => setMenyunting(null),
              )
            }
          />
        ) : (
          <div key={p.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Badge variant="secondary">{p.kode}</Badge>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Sunting ${p.kode}`}
                  disabled={menunggu}
                  onClick={() => setMenyunting(p.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Hapus ${p.kode}`}
                  disabled={menunggu}
                  onClick={() => jalankan(() => hapusProfilLulusan(p.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <p className="mt-1.5 text-sm">{p.deskripsi}</p>

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
          Belum ada profil lulusan. Tanpa ini, CPL tidak dapat ditelusuri kembali
          ke janji program studi kepada lulusannya.
        </p>
      ) : null}

      <FormulirProfil
        baru
        menunggu={menunggu}
        onSimpan={(kode, deskripsi, reset) =>
          jalankan(() => tambahProfilLulusan(kurikulumId, kode, deskripsi), reset)
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
  const [dipilih, setDipilih] = useState<string[]>(profil.cplId);

  const berubah =
    dipilih.length !== profil.cplId.length ||
    dipilih.some((id) => !profil.cplId.includes(id));

  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        CPL yang menopang profil ini
      </p>

      <div className="flex flex-wrap gap-1.5">
        {cpl.map((c) => {
          const aktif = dipilih.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={aktif}
              title={c.deskripsi}
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
            Kurikulum ini belum punya CPL.
          </span>
        ) : null}
      </div>

      {berubah ? (
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" disabled={menunggu} onClick={() => onSimpan(dipilih)}>
            <Check />
            Simpan pemetaan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={menunggu}
            onClick={() => setDipilih(profil.cplId)}
          >
            Batal
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
  awal?: { kode: string; deskripsi: string };
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (kode: string, deskripsi: string, reset: () => void) => void;
  onBatal?: () => void;
}) {
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
        onSimpan(kode, deskripsi, () => {
          if (!idForm) return;
          const form = document.getElementById(idForm) as HTMLFormElement | null;
          form?.reset();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${idForm ?? awal?.kode}-kode`}>Kode</Label>
        <Input
          id={`${idForm ?? awal?.kode}-kode`}
          name="kode"
          defaultValue={awal?.kode ?? ""}
          placeholder="PL1"
          className="w-24 font-mono"
          required
        />
      </div>

      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor={`${idForm ?? awal?.kode}-deskripsi`}>Profil lulusan</Label>
        <Input
          id={`${idForm ?? awal?.kode}-deskripsi`}
          name="deskripsi"
          defaultValue={awal?.deskripsi ?? ""}
          placeholder="Pengembang perangkat lunak untuk sistem informasi organisasi"
          required
        />
      </div>

      <Button type="submit" variant={baru ? "outline" : "default"} disabled={menunggu}>
        {baru ? <Plus /> : <Check />}
        {baru ? "Tambah" : "Simpan"}
      </Button>

      {onBatal ? (
        <Button type="button" variant="ghost" disabled={menunggu} onClick={onBatal}>
          <X />
          Batal
        </Button>
      ) : null}
    </form>
  );
}
