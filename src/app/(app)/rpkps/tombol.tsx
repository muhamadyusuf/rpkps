"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import { cn } from "@/lib/utils";
import { ajukanRpkps, buatRpkps, putuskanRpkps, type Hasil } from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (
    fn: () => Promise<Hasil>,
    opsi?: { tujuan?: (h: Hasil) => string | null; sesudah?: () => void },
  ) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        opsi?.sesudah?.();
        const ke = opsi?.tujuan?.(hasil);
        if (ke) router.push(ke);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
        if (hasil.id) router.push(`/rpkps/${hasil.id}`);
      }
    });
  return { menunggu, jalankan };
}

export function TombolBuatRpkps({
  mataKuliahId,
  tahunAkademikId,
  label = "Buat RPKPS",
}: {
  mataKuliahId: string;
  tahunAkademikId: string;
  label?: string;
}) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      size="sm"
      disabled={menunggu}
      onClick={() =>
        jalankan(() => buatRpkps(mataKuliahId, tahunAkademikId), {
          tujuan: (h) => (h.id ? `/rpkps/${h.id}` : null),
        })
      }
    >
      {menunggu ? "Menyiapkan…" : label}
    </Button>
  );
}

export function TombolAjukan({ id, aktif }: { id: string; aktif: boolean }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button disabled={menunggu || !aktif} onClick={() => jalankan(() => ajukanRpkps(id))}>
      {menunggu ? "Mengajukan…" : "Ajukan untuk pengesahan"}
    </Button>
  );
}

export function TombolPutusan({ id }: { id: string }) {
  const { menunggu, jalankan } = useAksi();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={menunggu}
        onClick={() => jalankan(() => putuskanRpkps(id, "SETUJU"))}
      >
        Setujui &amp; terbitkan
      </Button>
      <DialogRevisi id={id} menunggu={menunggu} jalankan={jalankan} />
    </div>
  );
}

/**
 * Dialog pengembalian untuk revisi.
 *
 * Menggantikan `prompt()` bawaan peramban, yang tampil di luar bahasa rupa
 * aplikasi dan — lebih penting — tidak bisa menolak isian kosong. Catatan di
 * sini WAJIB: tanpa itu dosen hanya melihat "Dikembalikan untuk revisi" di
 * histori dan harus menebak bagian mana yang salah.
 */
function DialogRevisi({
  id,
  menunggu,
  jalankan,
}: {
  id: string;
  menunggu: boolean;
  jalankan: (
    fn: () => Promise<Hasil>,
    opsi?: { tujuan?: (h: Hasil) => string | null; sesudah?: () => void },
  ) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [catatan, setCatatan] = useState("");

  const panjang = catatan.trim().length;
  const cukup = panjang >= MIN_CATATAN_REVISI;

  return (
    <Dialog
      open={buka}
      onOpenChange={(terbuka) => {
        setBuka(terbuka);
        // Isian dikosongkan saat dialog ditutup supaya catatan RPKPS yang satu
        // tidak terbawa ke RPKPS berikutnya.
        if (!terbuka) setCatatan("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" disabled={menunggu} />}>
        <Undo2 />
        Kembalikan untuk revisi
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kembalikan untuk revisi</DialogTitle>
          <DialogDescription>
            Catatan ini yang dibaca dosen pengampu. Sebutkan bagian mana yang
            harus diperbaiki — bukan sekadar bahwa dokumennya ditolak.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cukup) return;
            jalankan(() => putuskanRpkps(id, "REVISI", catatan.trim()), {
              sesudah: () => setBuka(false),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="catatan-revisi">Catatan revisi</Label>
            <textarea
              id="catatan-revisi"
              name="catatan"
              rows={5}
              autoFocus
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Bobot pada tabel mingguan berjumlah 95%, belum 100%. Sub-CPMK-4 juga belum muncul di pertemuan mana pun."
              className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Tercatat permanen di histori dokumen, dan ikut tampil di katalog
              publik saat RPKPS ini akhirnya terbit.
            </p>
            <span
              className={cn(
                "label-teknis shrink-0 tabular-nums",
                cukup ? "text-muted-foreground/70" : "text-warning",
              )}
            >
              {panjang}/{MIN_CATATAN_REVISI}
            </span>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Batal
            </DialogClose>
            <Button type="submit" disabled={menunggu || !cukup}>
              {menunggu ? "Mengembalikan…" : "Kembalikan untuk revisi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
