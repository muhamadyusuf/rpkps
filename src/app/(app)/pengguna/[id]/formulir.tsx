"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { hapusPeran, perbaruiProfil, tambahPeran, ubahStatus } from "../aksi";
import type { Peran, StatusPengguna } from "@/generated/prisma";

const SEMUA_PERAN: { nilai: Peran; label: string; butuhProdi: boolean }[] = [
  { nilai: "ADMIN", label: "Administrator", butuhProdi: false },
  { nilai: "GPM", label: "Penjaminan Mutu", butuhProdi: false },
  { nilai: "ASESOR", label: "Asesor", butuhProdi: false },
  { nilai: "KAPRODI", label: "Ketua Program Studi", butuhProdi: true },
  { nilai: "KOORDINATOR_MK", label: "Koordinator Mata Kuliah", butuhProdi: true },
  { nilai: "DOSEN", label: "Dosen", butuhProdi: true },
  { nilai: "MAHASISWA", label: "Mahasiswa", butuhProdi: true },
];

export function FormulirProfil({
  penggunaId,
  awal,
}: {
  penggunaId: string;
  awal: {
    nama: string;
    gelarDepan: string;
    gelarBelakang: string;
    nidn: string;
    nip: string;
    nik: string;
    telepon: string;
  };
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await perbaruiProfil(penggunaId, fd);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Bidang nama="gelarDepan" label="Gelar depan" awal={awal.gelarDepan} contoh="Dr." />
        <div className="sm:col-span-1">
          <Bidang nama="nama" label="Nama" awal={awal.nama} wajib />
        </div>
        <Bidang
          nama="gelarBelakang"
          label="Gelar belakang"
          awal={awal.gelarBelakang}
          contoh="S.Kom., M.Kom."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Bidang nama="nidn" label="NIDN" awal={awal.nidn} contoh="0412129501" />
        <Bidang nama="nip" label="NIP" awal={awal.nip} />
        <Bidang nama="nik" label="NIK" awal={awal.nik} />
        <Bidang nama="telepon" label="Telepon" awal={awal.telepon} />
      </div>

      <Button type="submit" disabled={menunggu}>
        {menunggu ? "Menyimpan…" : "Simpan profil"}
      </Button>
    </form>
  );
}

function Bidang({
  nama,
  label,
  awal,
  contoh,
  wajib,
}: {
  nama: string;
  label: string;
  awal: string;
  contoh?: string;
  wajib?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={nama}>
        {label}
        {wajib ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={nama} name={nama} defaultValue={awal} placeholder={contoh} />
    </div>
  );
}

export function PengaturPeran({
  penggunaId,
  penugasan,
  prodi,
}: {
  penggunaId: string;
  penugasan: { id: string; peran: Peran; prodiNama: string | null }[];
  prodi: { id: string; nama: string; kode: string }[];
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  function jalankan(fn: () => Promise<{ ok: boolean; pesan: string }>) {
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {penugasan.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada peran. Pengguna belum dapat mengakses data akademik.
          </p>
        ) : (
          penugasan.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1.5 py-1 pr-1 pl-2.5">
              {SEMUA_PERAN.find((p) => p.nilai === t.peran)?.label ?? t.peran}
              {t.prodiNama ? (
                <span className="text-muted-foreground">· {t.prodiNama}</span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={menunggu}
                aria-label="Hapus peran"
                onClick={() => jalankan(() => hapusPeran(t.id))}
              >
                <Trash2 />
              </Button>
            </Badge>
          ))
        )}
      </div>

      <form
        action={(fd) => {
          const peran = fd.get("peran") as Peran | null;
          const prodiId = (fd.get("prodiId") as string | null) || null;
          if (!peran) {
            toast.error("Pilih peran lebih dulu.");
            return;
          }
          jalankan(() => tambahPeran(penggunaId, peran, prodiId));
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="peran">Tambah peran</Label>
          <Select name="peran">
            <SelectTrigger id="peran" className="w-56">
              <SelectValue placeholder="Pilih peran" />
            </SelectTrigger>
            <SelectContent>
              {SEMUA_PERAN.map((p) => (
                <SelectItem key={p.nilai} value={p.nilai}>
                  {p.label}
                  {p.butuhProdi ? " (per prodi)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prodiId">Program studi</Label>
          <Select name="prodiId">
            <SelectTrigger id="prodiId" className="w-56">
              <SelectValue placeholder="— cakupan institusi —" />
            </SelectTrigger>
            <SelectContent>
              {prodi.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="outline" disabled={menunggu}>
          Tambah
        </Button>
      </form>
    </div>
  );
}

export function PengaturStatus({
  penggunaId,
  status,
}: {
  penggunaId: string;
  status: StatusPengguna;
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <Select
      value={status}
      onValueChange={(v) =>
        mulai(async () => {
          const hasil = await ubahStatus(penggunaId, v as StatusPengguna);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      disabled={menunggu}
    >
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="AKTIF">Aktif</SelectItem>
        <SelectItem value="MENUNGGU_VERIFIKASI">Menunggu verifikasi</SelectItem>
        <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
      </SelectContent>
    </Select>
  );
}
