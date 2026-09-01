"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tautan } from "@/components/tautan";
import {
  lepasKoordinatorMk,
  tetapkanKoordinatorMk,
  type Hasil,
} from "../../aksi-koordinator";

export type BarisPapan = {
  mataKuliahId: string;
  kurikulumId: string;
  kode: string;
  nama: string;
  semester: number;
  sks: number;
  koordinator: { penggunaId: string; nama: string; nonaktif: boolean } | null;
  ditetapkanOleh: string | null;
  rpkps: { id: string; status: string; koordinatorId: string | null } | null;
};

export type CalonDosen = { id: string; nama: string; prodi: string | null };

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const jalankan = (fn: () => Promise<Hasil>, sesudah?: () => void) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        sesudah?.();
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });

  return { menunggu, jalankan };
}

/**
 * Satu baris papan penugasan (docs/13 §2.4).
 *
 * Pemilih dosen tidak langsung menyimpan saat nilainya berubah: penugasan
 * dapat menggeser penanggung jawab dokumen yang sudah berjalan, dan tindakan
 * seberat itu tidak boleh terjadi karena kursor kebetulan lewat. Tombol
 * "Tetapkan" baru muncul setelah pilihannya benar-benar berbeda.
 */
export function BarisPenugasan({
  baris,
  tahunAkademikId,
  labelTa,
  calon,
  bolehKelola,
}: {
  baris: BarisPapan;
  tahunAkademikId: string;
  labelTa: string;
  calon: CalonDosen[];
  bolehKelola: boolean;
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const [pilihan, setPilihan] = useState<string>(baris.koordinator?.penggunaId ?? "");
  const [konfirmasi, setKonfirmasi] = useState(false);

  const berubah = pilihan !== "" && pilihan !== (baris.koordinator?.penggunaId ?? "");

  /**
   * RPKPS tahun ini sudah ada DAN dipegang orang lain — di situlah penugasan
   * berubah menjadi serah terima dokumen, dan di situlah dosen berhak tahu
   * lebih dulu.
   */
  const menggeserRpkps =
    berubah && baris.rpkps !== null && baris.rpkps.koordinatorId !== pilihan;

  const tetapkan = () =>
    jalankan(
      () => tetapkanKoordinatorMk(baris.mataKuliahId, tahunAkademikId, pilihan),
      () => setKonfirmasi(false),
    );

  return (
    <TableRow>
      <TableCell className="align-top">
        <Tautan
          href={`/kurikulum/${baris.kurikulumId}/mk/${baris.mataKuliahId}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {baris.kode}
        </Tautan>
        <p className="text-xs text-muted-foreground">
          {baris.nama} · smt {baris.semester} · {baris.sks} sks
        </p>
      </TableCell>

      <TableCell className="align-top">
        {baris.koordinator ? (
          <span className="flex flex-wrap items-center gap-1.5 text-sm">
            {baris.koordinator.nama}
            {baris.koordinator.nonaktif ? (
              <Badge variant="destructive" className="text-[10px]">
                {k.kurikulum.koordinator.nonaktif}
              </Badge>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {k.kurikulum.koordinator.belumDitetapkan}
          </span>
        )}
        {baris.ditetapkanOleh ? (
          <p className="text-xs text-muted-foreground">
            {isi(k.kurikulum.koordinator.olehSiapa, { nama: baris.ditetapkanOleh })}
          </p>
        ) : null}
      </TableCell>

      <TableCell className="align-top">
        {baris.rpkps ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Tautan
              href={`/rpkps/${baris.rpkps.id}`}
              className="text-sm underline-offset-4 hover:underline"
            >
              {k.kurikulum.koordinator.lihatRpkps}
            </Tautan>
            <Badge variant="outline" className="text-[10px]">
              {baris.rpkps.status}
            </Badge>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {k.kurikulum.koordinator.belumAdaRpkps}
          </span>
        )}
      </TableCell>

      {bolehKelola ? (
        <TableCell className="align-top">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="w-56">
              <Select value={pilihan} onValueChange={(v) => setPilihan(v ?? "")}>
                <SelectTrigger
                  aria-label={isi(k.kurikulum.koordinator.ariaKoordinator, {
                    kode: baris.kode,
                  })}
                >
                  <SelectValue placeholder={k.kurikulum.koordinator.pilihDosen} />
                </SelectTrigger>
                <SelectContent>
                  {calon.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nama}
                      {c.prodi ? ` · ${c.prodi}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {berubah ? (
              <Button
                size="sm"
                disabled={menunggu}
                onClick={() => (menggeserRpkps ? setKonfirmasi(true) : tetapkan())}
              >
                <UserCheck />
                {k.kurikulum.koordinator.tetapkan}
              </Button>
            ) : null}

            {baris.koordinator && !berubah ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={menunggu}
                title={k.kurikulum.koordinator.lepas}
                onClick={() =>
                  jalankan(() =>
                    lepasKoordinatorMk(baris.mataKuliahId, tahunAkademikId),
                  )
                }
              >
                <UserMinus />
              </Button>
            ) : null}
          </div>

          <Dialog open={konfirmasi} onOpenChange={setKonfirmasi}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {isi(k.kurikulum.koordinator.konfirmasiJudul, { kode: baris.kode })}
                </DialogTitle>
                <DialogDescription>
                  {isi(k.kurikulum.koordinator.konfirmasiIsi, {
                    kode: baris.kode,
                    ta: labelTa,
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  {k.kurikulum.koordinator.konfirmasiSidik}
                </p>
              </div>

              <DialogFooter className="mt-4">
                <DialogClose render={<Button type="button" variant="ghost" />}>
                  {k.kurikulum.koordinator.batal}
                </DialogClose>
                <Button disabled={menunggu} onClick={tetapkan}>
                  {menunggu
                    ? k.kurikulum.koordinator.menetapkan
                    : k.kurikulum.koordinator.tetapkanSerahkan}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
