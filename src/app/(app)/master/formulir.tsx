"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  aktifkanTahunAkademik,
  tambahProdi,
  tambahTahunAkademik,
  ubahAktifProdi,
  type HasilAksi,
} from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<HasilAksi>, formEl?: HTMLFormElement) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        formEl?.reset();
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  return { menunggu, jalankan };
}

export function FormulirProdi() {
  const { menunggu, jalankan } = useAksi();

  return (
    <form
      action={(fd) => jalankan(() => tambahProdi(fd))}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="nama">Nama program studi</Label>
        <Input id="nama" name="nama" placeholder="Teknologi Informasi" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kode">Kode</Label>
        <Input id="kode" name="kode" placeholder="TI" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="jenjang">Jenjang</Label>
        <Select name="jenjang" defaultValue="S1">
          <SelectTrigger id="jenjang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["D3", "D4", "S1", "S2", "S3", "PROFESI"].map((j) => (
              <SelectItem key={j} value={j}>
                {j}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gelar">Gelar</Label>
        <div className="flex gap-2">
          <Input id="gelar" name="gelar" placeholder="S.Kom." />
          <Button type="submit" disabled={menunggu}>
            {menunggu ? "…" : "Tambah"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function SakelarProdi({ id, aktif }: { id: string; aktif: boolean }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => ubahAktifProdi(id, !aktif))}
    >
      {aktif ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}

export function FormulirTahunAkademik() {
  const { menunggu, jalankan } = useAksi();
  const tahunIni = new Date().getFullYear();

  return (
    <form
      action={(fd) => jalankan(() => tambahTahunAkademik(fd))}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="tahunMulai">Tahun mulai</Label>
        <Input
          id="tahunMulai"
          name="tahunMulai"
          type="number"
          className="w-32"
          defaultValue={tahunIni}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="semester">Semester</Label>
        <Select name="semester" defaultValue="GANJIL">
          <SelectTrigger id="semester" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GANJIL">Ganjil</SelectItem>
            <SelectItem value="GENAP">Genap</SelectItem>
            <SelectItem value="ANTARA">Antara</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={menunggu}>
        {menunggu ? "…" : "Tambah"}
      </Button>
    </form>
  );
}

export function TombolAktifkanTahun({ id }: { id: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => aktifkanTahunAkademik(id))}
    >
      Jadikan aktif
    </Button>
  );
}
