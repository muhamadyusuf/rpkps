"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks, Pilihan } from "../pilihan";
import { buatUsulan } from "../aksi";

export function FormulirUsulanBaru({
  daftarMk,
  mkTerpilih,
}: {
  daftarMk: {
    id: string;
    kode: string;
    nama: string;
    semester: number;
    kurikulum: { nama: string; tahun: number };
  }[];
  mkTerpilih?: string;
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await buatUsulan(fd);
          if (hasil.ok && hasil.id) {
            toast.success(hasil.pesan);
            router.push(`/usulan/${hasil.id}`);
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="mataKuliahId">Mata kuliah</Label>
        <Pilihan id="mataKuliahId" nama="mataKuliahId" nilai={mkTerpilih}>
          {daftarMk.map((mk) => (
            <option key={mk.id} value={mk.id}>
              {mk.kode} — {mk.nama} (sem {mk.semester} · {mk.kurikulum.tahun})
            </option>
          ))}
        </Pilihan>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="judul">Judul usulan</Label>
        <Input
          id="judul"
          name="judul"
          placeholder="Penyegaran capaian basis data terkelola"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="latar">Latar belakang</Label>
        <AreaTeks
          id="latar"
          nama="latar"
          baris={5}
          placeholder="Mengapa revisi ini perlu. Kaprodi membaca bagian ini lebih dulu, sebelum melihat butir perubahannya."
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
        <input
          id="jalurRalat"
          name="jalurRalat"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <div className="space-y-0.5">
          <Label htmlFor="jalurRalat" className="font-medium">
            Ralat — berlaku segera
          </Label>
          <p className="text-xs text-muted-foreground">
            Hanya untuk perbaikan ejaan atau tanda baca yang tidak mengubah makna
            rumusan. Sistem memeriksanya sendiri: bila kata kerja operasional atau
            level Bloom bergeser, usulan ditahan dan harus menunggu tahun akademik
            berikutnya.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={menunggu}>
        Buat usulan
      </Button>
    </form>
  );
}
