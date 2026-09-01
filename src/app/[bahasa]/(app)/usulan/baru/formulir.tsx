"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
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
  const { jalur, k, isi } = useBahasa();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await buatUsulan(fd);
          if (hasil.ok && hasil.id) {
            toast.success(hasil.pesan);
            router.push(jalur(`/usulan/${hasil.id}`));
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="mataKuliahId">{k.usulan.baru.mataKuliah}</Label>
        <Pilihan id="mataKuliahId" nama="mataKuliahId" nilai={mkTerpilih}>
          {daftarMk.map((mk) => (
            <option key={mk.id} value={mk.id}>
              {isi(k.usulan.baru.pilihanMk, {
                kode: mk.kode,
                nama: mk.nama,
                semester: mk.semester,
                tahun: mk.kurikulum.tahun,
              })}
            </option>
          ))}
        </Pilihan>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="judul">{k.usulan.baru.judulUsulan}</Label>
        <Input
          id="judul"
          name="judul"
          placeholder={k.usulan.baru.contohJudul}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="latar">{k.usulan.baru.latar}</Label>
        <AreaTeks
          id="latar"
          nama="latar"
          baris={5}
          placeholder={k.usulan.baru.contohLatar}
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
            {k.usulan.baru.ralatLabel}
          </Label>
          <p className="text-xs text-muted-foreground">
            {k.usulan.baru.ralatPetunjuk}
          </p>
        </div>
      </div>

      <Button type="submit" disabled={menunggu}>
        {k.usulan.baru.buat}
      </Button>
    </form>
  );
}
