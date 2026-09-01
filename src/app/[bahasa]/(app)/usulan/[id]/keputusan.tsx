"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, Undo2, X } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
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
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
import { teksTemuan } from "@/lib/bahasa/temuan";
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
  const { k } = useBahasa();
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
            .map((t) => teksTemuan(t, k).pesan)
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
  const { k } = useBahasa();
  const [menyunting, setMenyunting] = useState(false);
  const [teks, setTeks] = useState(rumusan ?? "");
  const [catatan, setCatatan] = useState("");

  return (
    <div className="space-y-3 border-t pt-3">
      {menyunting ? (
        <div className="space-y-1.5">
          <Label htmlFor={`sunting-${butirId}`}>{k.usulan.keputusan.rumusanVersiAnda}</Label>
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
          {menyunting ? k.usulan.keputusan.terimaVersiIni : k.usulan.keputusan.terima}
        </Button>

        {dapatDisunting && !menyunting ? (
          <Button
            size="sm"
            variant="outline"
            disabled={menunggu}
            onClick={() => setMenyunting(true)}
          >
            {k.usulan.keputusan.sesuaikanDulu}
          </Button>
        ) : null}

        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="outline" disabled={menunggu} />}>
            <X />
            {k.usulan.keputusan.tolak}
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{k.usulan.keputusan.tolakButirJudul}</DialogTitle>
              <DialogDescription>
                {k.usulan.keputusan.tolakButirKeterangan}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`tolak-${butirId}`}>{k.usulan.keputusan.catatan}</Label>
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
                {k.usulan.keputusan.tolakButir}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {status !== "BARU" ? (
          <span className="text-xs text-muted-foreground">
            {k.usulan.keputusan.dapatDiubah}
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
  const { k } = useBahasa();

  return (
    <>
      {status === "DRAF" || status === "DIREVISI" ? (
        <Button disabled={menunggu} onClick={() => jalankan(() => ajukanUsulan(usulanId))}>
          <Send />
          {k.usulan.keputusan.ajukan}
        </Button>
      ) : null}
      {adalahPengusul && status !== "DITERAPKAN" ? (
        <Button
          variant="outline"
          disabled={menunggu}
          onClick={() => jalankan(() => tarikUsulan(usulanId))}
        >
          {k.usulan.keputusan.tarik}
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
  const { k } = useBahasa();
  const [taId, setTaId] = useState(taBawaan?.id ?? "");
  const [catatan, setCatatan] = useState("");

  return (
    <>
      <Dialog>
        <DialogTrigger
          render={<Button disabled={menunggu || adaButirBelumDiputuskan} />}
        >
          <Check />
          {k.usulan.keputusan.sahkan}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{k.usulan.keputusan.sahkanJudul}</DialogTitle>
            <DialogDescription>{k.usulan.keputusan.sahkanKeterangan}</DialogDescription>
          </DialogHeader>

          {jalurRalat ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {k.usulan.keputusan.ralatAwal}{" "}
              <strong>{k.usulan.keputusan.ralatTebal}</strong>{" "}
              {k.usulan.keputusan.ralatAkhir}
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="berlakuMulaiTa">{k.usulan.keputusan.berlakuMulai}</Label>
              <Pilihan
                id="berlakuMulaiTa"
                nama="berlakuMulaiTa"
                nilai={taId}
                onChange={setTaId}
              >
                {daftarTa.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.kode}
                    {t.id === taBawaan?.id ? k.usulan.keputusan.disarankan : ""}
                  </option>
                ))}
              </Pilihan>
              <p className="text-xs text-muted-foreground">
                {k.usulan.keputusan.berlakuPetunjuk}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={menunggu}
              onClick={() => jalankan(() => sahkanUsulan(usulanId, taId || undefined))}
            >
              {k.usulan.keputusan.sahkanTerapkan}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="outline" disabled={menunggu} />}>
          <Undo2 />
          {k.usulan.keputusan.kembalikan}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{k.usulan.keputusan.kembalikan}</DialogTitle>
            <DialogDescription>{k.usulan.keputusan.kembalikanKeterangan}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="catatan-revisi">{k.usulan.keputusan.catatanRevisi}</Label>
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
              {k.usulan.keputusan.tombolKembalikan}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="ghost" disabled={menunggu} />}>
          {k.usulan.keputusan.tolakUsulan}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{k.usulan.keputusan.tolakUsulanJudul}</DialogTitle>
            <DialogDescription>{k.usulan.keputusan.tolakUsulanKeterangan}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="catatan-tolak">{k.usulan.keputusan.alasanPenolakan}</Label>
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
              {k.usulan.keputusan.tolakUsulan}
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
