"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TombolIkon } from "@/components/tombol-ikon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hapusPeran, perbaruiNamaLokal, sinkronkanPenggunaIni, tambahPeran, ubahStatus } from "../aksi";
import { peranLokalBoleh } from "@/domain/identitas/peran";
import type { Peran, StatusPengguna } from "@/generated/prisma";

/**
 * Urutan tampil peran, dari yang paling luas cakupannya. Namanya TIDAK di
 * sini melainkan di `kamus.enum.peran` — daftar ini hanya menyimpan urutan
 * dan apakah peran itu butuh prodi.
 */
export const SEMUA_PERAN: { nilai: Peran; butuhProdi: boolean }[] = [
  { nilai: "ADMIN", butuhProdi: false },
  { nilai: "GPM", butuhProdi: false },
  { nilai: "ASESOR", butuhProdi: false },
  { nilai: "KAPRODI", butuhProdi: true },
  { nilai: "KOORDINATOR_MK", butuhProdi: true },
  { nilai: "DOSEN", butuhProdi: true },
  { nilai: "MAHASISWA", butuhProdi: true },
];

/** Hanya untuk pengguna LOKAL. Nama pegawai dikelola di identitas-itts, jadi tak ada formulir untuknya. */
export function FormulirNamaLokal({ penggunaId, awal }: { penggunaId: string; awal: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await perbaruiNamaLokal(penggunaId, fd);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor="nama">
          {k.penggunaDetail.nama}
          <span className="text-destructive"> *</span>
        </Label>
        <Input id="nama" name="nama" defaultValue={awal} required />
      </div>
      <Button type="submit" disabled={menunggu}>
        {menunggu ? k.penggunaDetail.menyimpan : k.penggunaDetail.simpanNama}
      </Button>
    </form>
  );
}

/** Menyelaraskan peran seorang pegawai dengan identitas-itts tanpa menunggu sinkron berikutnya. */
export function TombolSinkronPengguna({ penggunaId }: { penggunaId: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={menunggu}
      onClick={() =>
        mulai(async () => {
          const hasil = await sinkronkanPenggunaIni(penggunaId);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
    >
      {menunggu ? k.pengguna.sinkron.berjalan : k.penggunaDetail.sinkronkanIni}
    </Button>
  );
}

export function PengaturPeran({
  penggunaId,
  penugasan,
  prodi,
  bertaut,
}: {
  penggunaId: string;
  penugasan: { id: string; peran: Peran; prodiNama: string | null; dariIdentitas: boolean }[];
  prodi: { id: string; nama: string; kode: string }[];
  /** Pegawai (bertaut ke identitas-itts): boleh diberi peran lokal apa pun. Pengguna lokal: hanya Asesor/Mahasiswa. */
  bertaut: boolean;
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

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
            {k.penggunaDetail.tanpaPeran}
          </p>
        ) : (
          penugasan.map((t) => (
            <Badge
              key={t.id}
              variant={t.dariIdentitas ? "outline" : "secondary"}
              className={t.dariIdentitas ? "gap-1.5 py-1 pr-2.5 pl-2.5" : "gap-1.5 py-1 pr-1 pl-2.5"}
              title={t.dariIdentitas ? k.pengguna.peranDariJabatan : undefined}
            >
              {k.enum.peran[t.peran] ?? t.peran}
              {t.prodiNama ? (
                <span className="text-muted-foreground">· {t.prodiNama}</span>
              ) : null}
              {t.dariIdentitas ? (
                <span className="text-muted-foreground">· {k.penggunaDetail.peranDariJabatan}</span>
              ) : (
                <TombolIkon
                  type="button"
                  size="icon-xs"
                  petunjuk={k.penggunaDetail.cabutPeran}
                  disabled={menunggu}
                  onClick={() => jalankan(() => hapusPeran(t.id))}
                >
                  <Trash2 />
                </TombolIkon>
              )}
            </Badge>
          ))
        )}
      </div>

      <form
        action={(fd) => {
          const peran = fd.get("peran") as Peran | null;
          const prodiId = (fd.get("prodiId") as string | null) || null;
          if (!peran) {
            toast.error(k.penggunaDetail.pilihPeranDulu);
            return;
          }
          jalankan(() => tambahPeran(penggunaId, peran, prodiId));
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="peran">{k.penggunaDetail.tambahPeran}</Label>
          <Select name="peran">
            <SelectTrigger id="peran" className="w-56">
              <SelectValue placeholder={k.penggunaDetail.pilihPeran} />
            </SelectTrigger>
            <SelectContent>
              {SEMUA_PERAN.filter((p) => peranLokalBoleh(bertaut, p.nilai)).map((p) => (
                <SelectItem key={p.nilai} value={p.nilai}>
                  {k.enum.peran[p.nilai]}
                  {p.butuhProdi ? k.penggunaDetail.perProdi : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prodiId">{k.penggunaDetail.programStudi}</Label>
          <Select name="prodiId">
            <SelectTrigger id="prodiId" className="w-56">
              <SelectValue placeholder={k.penggunaDetail.cakupanInstitusi} />
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
          {k.penggunaDetail.tambah}
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
  const { k } = useBahasa();

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
        <SelectItem value="AKTIF">{k.enum.statusPengguna.AKTIF}</SelectItem>
        <SelectItem value="MENUNGGU_VERIFIKASI">
          {k.enum.statusPengguna.MENUNGGU_VERIFIKASI}
        </SelectItem>
        <SelectItem value="NONAKTIF">{k.enum.statusPengguna.NONAKTIF}</SelectItem>
      </SelectContent>
    </Select>
  );
}
