"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tambahPengguna } from "./aksi";
import { SEMUA_PERAN } from "./[id]/formulir";

/**
 * Admin membuat akun langsung dari sini \u2014 pemiliknya tidak perlu mendaftar
 * sendiri lalu menunggu diverifikasi. Akun langsung AKTIF; ia hanya perlu
 * masuk dengan akun Google beralamat sama (lihat `firebaseUidUndangan` di
 * `src/lib/sesi.ts` untuk cara penautannya).
 */
export function FormulirTambahPengguna({
  prodi,
}: {
  prodi: { id: string; nama: string; kode: string }[];
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await tambahPengguna(fd);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="email">{k.pengguna.tambah.email}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nama">{k.pengguna.tambah.nama}</Label>
        <Input id="nama" name="nama" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="peran">{k.pengguna.tambah.peran}</Label>
        <Select name="peran">
          <SelectTrigger id="peran">
            <SelectValue placeholder={k.pengguna.tambah.tanpaPeran} />
          </SelectTrigger>
          <SelectContent>
            {SEMUA_PERAN.map((p) => (
              <SelectItem key={p.nilai} value={p.nilai}>
                {k.enum.peran[p.nilai]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prodiId">{k.pengguna.tambah.programStudi}</Label>
        <div className="flex gap-2">
          <Select name="prodiId">
            <SelectTrigger id="prodiId">
              <SelectValue placeholder={k.pengguna.tambah.cakupanInstitusi} />
            </SelectTrigger>
            <SelectContent>
              {prodi.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={menunggu}>
            {menunggu ? k.pengguna.tambah.menyimpan : k.pengguna.tambah.tombol}
          </Button>
        </div>
      </div>
    </form>
  );
}
