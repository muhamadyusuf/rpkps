"use client";

import { useState, useTransition } from "react";
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
import {
  aktifkanTahunAkademik,
  aturTenggat,
  type JenisTenggat,
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
  const { k } = useBahasa();

  return (
    <form
      action={(fd) => jalankan(() => tambahProdi(fd))}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="nama">{k.master.prodi.labelNama}</Label>
        <Input
          id="nama"
          name="nama"
          placeholder={k.master.prodi.contohNama}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kode">{k.master.prodi.labelKode}</Label>
        <Input
          id="kode"
          name="kode"
          placeholder={k.master.prodi.contohKode}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="jenjang">{k.master.prodi.labelJenjang}</Label>
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
        <Label htmlFor="gelar">{k.master.prodi.labelGelar}</Label>
        <div className="flex gap-2">
          <Input id="gelar" name="gelar" placeholder={k.master.prodi.contohGelar} />
          <Button type="submit" disabled={menunggu}>
            {menunggu ? "…" : k.master.prodi.tombolTambah}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function SakelarProdi({ id, aktif }: { id: string; aktif: boolean }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => ubahAktifProdi(id, !aktif))}
    >
      {aktif ? k.master.prodi.nonaktifkan : k.master.prodi.aktifkan}
    </Button>
  );
}

export function FormulirTahunAkademik() {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();
  const tahunIni = new Date().getFullYear();

  return (
    <form
      action={(fd) => jalankan(() => tambahTahunAkademik(fd))}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="tahunMulai">{k.master.tahun.labelTahunMulai}</Label>
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
        <Label htmlFor="semester">{k.master.tahun.labelSemester}</Label>
        <Select name="semester" defaultValue="GANJIL">
          <SelectTrigger id="semester" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GANJIL">{k.enum.semester.GANJIL}</SelectItem>
            <SelectItem value="GENAP">{k.enum.semester.GENAP}</SelectItem>
            <SelectItem value="ANTARA">{k.enum.semester.ANTARA}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={menunggu}>
        {menunggu ? "…" : k.master.prodi.tombolTambah}
      </Button>
    </form>
  );
}

/**
 * Tenggat disimpan saat kolomnya kehilangan fokus, tanpa tombol tersendiri.
 * Tiga kolom tanggal per baris tabel — penyusunan, review, pengesahan — dan
 * tiap tombol simpan akan menambah satu kolom lagi yang tidak menerangkan apa
 * pun.
 *
 * Isian yang ditolak (urutannya terbalik) dikembalikan ke nilai semula, bukan
 * dibiarkan menampilkan tanggal yang sebenarnya tidak tersimpan.
 */
export function KolomTenggat({
  id,
  jenis,
  awal,
  label,
}: {
  id: string;
  jenis: JenisTenggat;
  awal: string;
  label: string;
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const [nilai, setNilai] = useState(awal);

  return (
    <Input
      type="date"
      aria-label={label}
      className="w-36"
      value={nilai}
      disabled={menunggu}
      onChange={(e) => setNilai(e.target.value)}
      onBlur={() =>
        mulai(async () => {
          if (nilai === awal) return;
          const hasil = await aturTenggat(id, jenis, nilai || null);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
            setNilai(awal); // urutan yang ditolak tidak boleh tampak tersimpan
          }
        })
      }
    />
  );
}

export function TombolAktifkanTahun({ id }: { id: string }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => aktifkanTahunAkademik(id))}
    >
      {k.master.tahun.jadikanAktif}
    </Button>
  );
}
