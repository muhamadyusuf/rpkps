"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
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
import { PERAN_NON_PEGAWAI } from "@/domain/identitas/peran";
import { cariPegawaiPemilih, tambahPegawai, tambahPengguna, type PegawaiPilihan } from "./aksi";
import { SEMUA_PERAN } from "./[id]/formulir";

type Mode = "pegawai" | "lain";

/**
 * Dua jalan masuk pengguna baru (docs/26 §3):
 *
 *   - PEGAWAI dipilih dari identitas-itts. RPKPS hanya menyimpan kuncinya; nama dan
 *     perannya (dari jabatan) tetap datang dari sana.
 *   - ASESOR / MAHASISWA dibuat di sini, karena mereka tidak ada di identitas-itts.
 *     Akun langsung AKTIF; pemiliknya cukup masuk dengan akun Google beralamat sama
 *     (lihat `firebaseUidUndangan` di `src/lib/sesi.ts` untuk cara penautannya).
 */
export function FormulirTambahPengguna({
  prodi,
  identitasAktif,
}: {
  prodi: { id: string; nama: string; kode: string }[];
  identitasAktif: boolean;
}) {
  const { k } = useBahasa();
  const [mode, setMode] = useState<Mode>(identitasAktif ? "pegawai" : "lain");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border p-0.5" role="tablist">
        <TabMode aktif={mode === "pegawai"} onPilih={() => setMode("pegawai")}>
          {k.pengguna.tambah.pegawai.tab}
        </TabMode>
        <TabMode aktif={mode === "lain"} onPilih={() => setMode("lain")}>
          {k.pengguna.tambah.lain.tab}
        </TabMode>
      </div>

      {mode === "pegawai" ? (
        <PemilihPegawai identitasAktif={identitasAktif} />
      ) : (
        <FormulirNonPegawai prodi={prodi} />
      )}
    </div>
  );
}

function TabMode({
  aktif,
  onPilih,
  children,
}: {
  aktif: boolean;
  onPilih: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktif}
      onClick={onPilih}
      className={
        aktif
          ? "rounded-sm bg-secondary px-3 py-1 text-sm font-medium"
          : "rounded-sm px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function PemilihPegawai({ identitasAktif }: { identitasAktif: boolean }) {
  const { k } = useBahasa();
  const router = useRouter();
  const [mencari, mulaiCari] = useTransition();
  const [menambah, mulaiTambah] = useTransition();
  const [hasil, setHasil] = useState<PegawaiPilihan[] | null>(null);

  if (!identitasAktif) {
    return <p className="text-sm text-muted-foreground">{k.pengguna.tambah.pegawai.belumAktif}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{k.pengguna.tambah.pegawai.keterangan}</p>

      <form
        action={(fd) =>
          mulaiCari(async () => {
            const jawab = await cariPegawaiPemilih(String(fd.get("q") ?? ""));
            if (jawab.ok) setHasil(jawab.pegawai);
            else toast.error(jawab.pesan);
          })
        }
        className="flex max-w-xl items-end gap-2"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cari-pegawai">{k.pengguna.tambah.pegawai.cariLabel}</Label>
          <Input
            id="cari-pegawai"
            name="q"
            minLength={2}
            maxLength={100}
            required
            placeholder={k.pengguna.tambah.pegawai.cariPlaceholder}
          />
        </div>
        <Button type="submit" variant="outline" disabled={mencari}>
          {mencari ? k.pengguna.tambah.pegawai.mencari : k.pengguna.tambah.pegawai.cari}
        </Button>
      </form>

      {hasil === null ? null : hasil.length === 0 ? (
        <p className="text-sm text-muted-foreground">{k.pengguna.tambah.pegawai.tidakAda}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {hasil.map((p) => (
            <li key={p.akunId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.namaLengkap}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.email}
                  {p.nomorInduk ? ` · ${p.nomorInduk}` : ""}
                </p>
              </div>
              {p.sudahAda ? (
                <Badge variant="secondary" className="text-[10px]">
                  {k.pengguna.tambah.pegawai.sudahAda}
                </Badge>
              ) : !p.aktif ? (
                <Badge variant="outline" className="text-[10px]">
                  {k.pengguna.tambah.pegawai.nonaktif}
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={menambah}
                  onClick={() =>
                    mulaiTambah(async () => {
                      const jawab = await tambahPegawai(p.akunId);
                      if (jawab.ok) {
                        toast.success(jawab.pesan);
                        setHasil((lama) => lama?.map((x) => (x.akunId === p.akunId ? { ...x, sudahAda: true } : x)) ?? null);
                        router.refresh();
                      } else {
                        toast.error(jawab.pesan);
                      }
                    })
                  }
                >
                  {k.pengguna.tambah.pegawai.tambahkan}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormulirNonPegawai({ prodi }: { prodi: { id: string; nama: string; kode: string }[] }) {
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
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">{k.pengguna.tambah.lain.keterangan}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
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
          <Select name="peran" required>
            <SelectTrigger id="peran">
              <SelectValue placeholder={k.pengguna.tambah.tanpaPeran} />
            </SelectTrigger>
            <SelectContent>
              {SEMUA_PERAN.filter((p) => PERAN_NON_PEGAWAI.includes(p.nilai)).map((p) => (
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
      </div>
    </form>
  );
}
