"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, PenLine, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
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
import {
  ajukanRpkps,
  buatRpkps,
  kembalikanRpkps,
  mintaParaf,
  parafPengampu,
  sahkanRpkps,
  setujuiRpkps,
  type Hasil,
} from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { jalur } = useBahasa();
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
        if (ke) router.push(jalur(ke));
        router.refresh();
      } else {
        toast.error(hasil.pesan);
        if (hasil.id) router.push(jalur(`/rpkps/${hasil.id}`));
      }
    });
  return { menunggu, jalankan };
}

/**
 * Dua jalur pembuatan, sengaja tidak setara (docs/09 §K7).
 *
 * Bawaannya tetap kerangka otomatis — 16 pertemuan bernomor beserta alokasi
 * waktunya — karena halaman kosong adalah hambatan terbesar dosen. Jalur
 * "tabel kosong" ada untuk yang memang ingin menyusun sendiri dari nol, dan
 * ditulis lebih kecil supaya tidak terpilih karena kebetulan.
 */
export function TombolBuatRpkps({
  mataKuliahId,
  tahunAkademikId,
  label,
}: {
  mataKuliahId: string;
  tahunAkademikId: string;
  label?: string;
}) {
  const { k } = useBahasa();
  const { menunggu, jalankan } = useAksi();
  const buat = (kerangka: "OTOMATIS" | "KOSONG") =>
    jalankan(() => buatRpkps(mataKuliahId, tahunAkademikId, kerangka), {
      tujuan: (h) => (h.id ? `/rpkps/${h.id}` : null),
    });

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button size="sm" disabled={menunggu} onClick={() => buat("OTOMATIS")}>
        {menunggu ? k.rpkps.tombol.menyiapkan : (label ?? k.rpkps.tombol.buat)}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={menunggu}
        title={k.rpkps.tabelKosongPetunjuk}
        onClick={() => buat("KOSONG")}
      >
        {k.rpkps.tabelKosong}
      </Button>
    </div>
  );
}

/**
 * Paraf pengampu — cap pertama pada rantai (docs/14 §2.2).
 *
 * Tetap dapat ditekan ulang setelah sudah memaraf: bila isi dokumen berubah,
 * paraf lama tidak lagi berlaku, dan menekan tombol yang sama adalah cara
 * memperbaruinya.
 */
export function TombolParaf({ id, sudah }: { id: string; sudah: boolean }) {
  const { k } = useBahasa();
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      variant={sudah ? "ghost" : "outline"}
      disabled={menunggu}
      onClick={() => jalankan(() => parafPengampu(id))}
    >
      <PenLine />
      {menunggu
        ? k.rpkps.tombol.menandatangani
        : sudah
          ? k.rpkps.tombol.parafUlang
          : k.rpkps.tombol.paraf}
    </Button>
  );
}

/**
 * "Minta paraf" — tahap P6 (docs/14 §4.2).
 *
 * Hanya muncul bagi koordinator, dan hanya selama masih ada yang belum
 * memaraf: tombol yang tetap ada setelah tim lengkap mengundang pengiriman
 * kabar yang tidak menuntut perbuatan siapa pun.
 */
export function TombolMintaParaf({ id, kurang }: { id: string; kurang: number }) {
  const { k, isi } = useBahasa();
  const { menunggu, jalankan } = useAksi();
  if (kurang === 0) return null;

  return (
    <Button
      variant="ghost"
      disabled={menunggu}
      title={isi(k.rpkps.tombol.mintaParafPetunjuk, { jumlah: kurang })}
      onClick={() => jalankan(() => mintaParaf(id))}
    >
      <BellRing />
      {menunggu ? k.rpkps.tombol.mengirim : k.rpkps.tombol.mintaParaf}
    </Button>
  );
}

/** Cap koordinator, "a.n Tim penyusun RPKPS" — sekaligus pengajuannya. */
export function TombolAjukan({ id, aktif }: { id: string; aktif: boolean }) {
  const { k } = useBahasa();
  const { menunggu, jalankan } = useAksi();
  return (
    <Button disabled={menunggu || !aktif} onClick={() => jalankan(() => ajukanRpkps(id))}>
      {menunggu ? k.rpkps.tombol.mengajukan : k.rpkps.tombol.ajukan}
    </Button>
  );
}

/**
 * Dua putusan, dua pemilik — tombolnya satu komponen karena bentuknya sama,
 * tetapi tahapnya menentukan kalimat dan aksinya. "Setujui & terbitkan" sudah
 * tidak ada: menyetujui bukan menerbitkan.
 */
export function TombolPutusan({ id, tahap }: { id: string; tahap: "REVIEW" | "PENGESAHAN" }) {
  const { k } = useBahasa();
  const { menunggu, jalankan } = useAksi();
  const review = tahap === "REVIEW";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={menunggu}
        onClick={() => jalankan(() => (review ? setujuiRpkps(id) : sahkanRpkps(id)))}
      >
        {review ? k.rpkps.tombol.setujui : k.rpkps.tombol.sahkan}
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
  const { k } = useBahasa();
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
        {k.rpkps.kembalikan.tombol}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{k.rpkps.kembalikan.judul}</DialogTitle>
          <DialogDescription>{k.rpkps.kembalikan.keterangan}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cukup) return;
            jalankan(() => kembalikanRpkps(id, catatan.trim()), {
              sesudah: () => setBuka(false),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="catatan-revisi">{k.rpkps.kembalikan.catatanRevisi}</Label>
            <textarea
              id="catatan-revisi"
              name="catatan"
              rows={5}
              autoFocus
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={k.rpkps.kembalikan.contohCatatan}
              className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {k.rpkps.kembalikan.tercatat}
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
              {k.umum.batal}
            </DialogClose>
            <Button type="submit" disabled={menunggu || !cukup}>
              {menunggu
                ? k.rpkps.kembalikan.mengembalikan
                : k.rpkps.kembalikan.tombol}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
