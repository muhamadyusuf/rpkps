"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StatusButir } from "@/domain/kurikulum/usulan";
import type { StatusUsulan } from "@/generated/prisma";
import { AreaTeks, Pilihan } from "../pilihan";
import {
  ajukanUsulan,
  kembalikanUntukRevisi,
  putuskanButir,
  sahkanUsulan,
  tarikUsulan,
  tolakUsulan,
  type Hasil,
} from "../aksi";

const MIN_CATATAN = 12;

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
        // Temuan pemblokir ikut ditampilkan supaya Kaprodi tahu apa yang
        // menahan, bukan sekadar bahwa aksinya gagal.
        toast.error(hasil.pesan, {
          description: hasil.temuan
            ?.filter((t) => t.tingkat === "PEMBLOKIR")
            .map((t) => t.pesan)
            .join(" "),
        });
      }
    });
  return { menunggu, jalankan };
}

/** Keputusan per butir. "Sesuaikan" membuat kalimat akhir jadi kalimat Kaprodi. */
export function KeputusanButir({
  butirId,
  status,
  rumusan,
  dapatDisunting,
}: {
  butirId: string;
  status: StatusButir;
  rumusan: string | null;
  dapatDisunting: boolean;
}) {
  const { menunggu, jalankan } = useAksi();
  const [menyunting, setMenyunting] = useState(false);
  const [teks, setTeks] = useState(rumusan ?? "");
  const [catatan, setCatatan] = useState("");

  return (
    <div className="space-y-3 border-t pt-3">
      {menyunting ? (
        <div className="space-y-1.5">
          <Label htmlFor={`sunting-${butirId}`}>Rumusan versi Anda</Label>
          <AreaTeks
            id={`sunting-${butirId}`}
            nama="rumusan"
            nilai={teks}
            onChange={setTeks}
            baris={3}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={menunggu}
          onClick={() =>
            jalankan(() =>
              putuskanButir(butirId, "DITERIMA", menyunting ? teks : undefined),
            )
          }
        >
          <Check />
          {menyunting ? "Terima versi ini" : "Terima"}
        </Button>

        {dapatDisunting && !menyunting ? (
          <Button
            size="sm"
            variant="outline"
            disabled={menunggu}
            onClick={() => setMenyunting(true)}
          >
            Sesuaikan dulu
          </Button>
        ) : null}

        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="outline" disabled={menunggu} />}>
            <X />
            Tolak
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Tolak butir ini</DialogTitle>
              <DialogDescription>
                Catatan penolakan dibaca pengusul. Sebutkan alasannya — butir yang
                ditolak tanpa keterangan hanya akan diusulkan ulang apa adanya.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`tolak-${butirId}`}>Catatan</Label>
              <AreaTeks
                id={`tolak-${butirId}`}
                nama="catatan"
                nilai={catatan}
                onChange={setCatatan}
                baris={4}
              />
              <HitungKarakter panjang={catatan.trim().length} />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={menunggu || catatan.trim().length < MIN_CATATAN}
                onClick={() =>
                  jalankan(() => putuskanButir(butirId, "DITOLAK", undefined, catatan))
                }
              >
                Tolak butir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {status !== "BARU" ? (
          <span className="text-xs text-muted-foreground">
            Keputusan dapat diubah selama usulan belum disahkan.
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TindakanPengusul({
  usulanId,
  adalahPengusul,
  status,
}: {
  usulanId: string;
  adalahPengusul: boolean;
  status: StatusUsulan;
}) {
  const { menunggu, jalankan } = useAksi();

  return (
    <>
      {status === "DRAF" || status === "DIREVISI" ? (
        <Button disabled={menunggu} onClick={() => jalankan(() => ajukanUsulan(usulanId))}>
          <Send />
          Ajukan ke Ketua Program Studi
        </Button>
      ) : null}
      {adalahPengusul && status !== "DITERAPKAN" ? (
        <Button
          variant="outline"
          disabled={menunggu}
          onClick={() => jalankan(() => tarikUsulan(usulanId))}
        >
          Tarik usulan
        </Button>
      ) : null}
    </>
  );
}

export function TindakanPemutus({
  usulanId,
  jalurRalat,
  taBawaan,
  daftarTa,
  adaButirBelumDiputuskan,
}: {
  usulanId: string;
  jalurRalat: boolean;
  taBawaan: { id: string; kode: string } | null;
  daftarTa: { id: string; kode: string }[];
  adaButirBelumDiputuskan: boolean;
}) {
  const { menunggu, jalankan } = useAksi();
  const [taId, setTaId] = useState(taBawaan?.id ?? "");
  const [catatan, setCatatan] = useState("");

  return (
    <>
      <Dialog>
        <DialogTrigger
          render={<Button disabled={menunggu || adaButirBelumDiputuskan} />}
        >
          <Check />
          Sahkan
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sahkan usulan</DialogTitle>
            <DialogDescription>
              Butir yang Anda terima akan ditulis ke kurikulum. Langkah ini tidak
              dapat dibatalkan — capaian yang dipensiunkan hanya ditandai, tidak
              dihapus, sehingga RPKPS lama tetap utuh.
            </DialogDescription>
          </DialogHeader>

          {jalurRalat ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Usulan ini menempuh <strong>jalur ralat</strong> dan berlaku segera.
              Sistem sudah memastikan rumusannya tidak menggeser kata kerja
              operasional maupun level Bloom.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="berlakuMulaiTa">Berlaku mulai tahun akademik</Label>
              <Pilihan
                id="berlakuMulaiTa"
                nama="berlakuMulaiTa"
                nilai={taId}
                onChange={setTaId}
              >
                {daftarTa.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.kode}
                    {t.id === taBawaan?.id ? " (disarankan)" : ""}
                  </option>
                ))}
              </Pilihan>
              <p className="text-xs text-muted-foreground">
                Bakunya tahun akademik berikutnya. Mengubah capaian di tengah
                semester berjalan berarti mahasiswa dinilai atas rumusan yang
                berbeda dari yang diumumkan di awal.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={menunggu}
              onClick={() => jalankan(() => sahkanUsulan(usulanId, taId || undefined))}
            >
              Sahkan dan terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="outline" disabled={menunggu} />}>
          <Undo2 />
          Kembalikan untuk revisi
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kembalikan untuk revisi</DialogTitle>
            <DialogDescription>
              Usulan kembali ke pengusul dan seluruh keputusan butir direset.
              Sebutkan apa yang harus diperbaiki.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="catatan-revisi">Catatan revisi</Label>
            <AreaTeks
              id="catatan-revisi"
              nama="catatan"
              nilai={catatan}
              onChange={setCatatan}
              baris={4}
            />
            <HitungKarakter panjang={catatan.trim().length} />
          </div>
          <DialogFooter>
            <Button
              disabled={menunggu || catatan.trim().length < MIN_CATATAN}
              onClick={() => jalankan(() => kembalikanUntukRevisi(usulanId, catatan))}
            >
              Kembalikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="ghost" disabled={menunggu} />}>
          Tolak usulan
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tolak seluruh usulan</DialogTitle>
            <DialogDescription>
              Dipakai ketika usulan tidak layak dilanjutkan sama sekali. Bila hanya
              sebagian yang bermasalah, kembalikan untuk revisi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="catatan-tolak">Alasan penolakan</Label>
            <AreaTeks
              id="catatan-tolak"
              nama="catatan"
              nilai={catatan}
              onChange={setCatatan}
              baris={4}
            />
            <HitungKarakter panjang={catatan.trim().length} />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={menunggu || catatan.trim().length < MIN_CATATAN}
              onClick={() => jalankan(() => tolakUsulan(usulanId, catatan))}
            >
              Tolak usulan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HitungKarakter({ panjang }: { panjang: number }) {
  const cukup = panjang >= MIN_CATATAN;
  return (
    <span
      className={cn(
        "label-teknis block text-right tabular-nums",
        cukup ? "text-muted-foreground/70" : "text-warning",
      )}
    >
      {panjang}/{MIN_CATATAN}
    </span>
  );
}
