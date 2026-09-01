"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, LockOpen, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teksTemuan } from "@/lib/bahasa/temuan";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bukaKembali,
  hapusTemuan,
  simpanCatatanProses,
  simpanTemuan,
  teruskanKeUsulan,
  tutupEvaluasi,
  verifikasiTemuan,
  type Hasil,
} from "./aksi";

function useAksi() {
  const { k } = useBahasa();
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<Hasil>, sesudah?: () => void) =>
    mulai(async () => {
      const h = await fn();
      if (h.ok) {
        toast.success(h.pesan);
        sesudah?.();
        router.refresh();
      } else {
        toast.error(h.pesan);
        for (const t of h.temuan?.filter((x) => x.tingkat === "PEMBLOKIR").slice(0, 4) ?? []) {
          toast.error(teksTemuan(t, k).pesan);
        }
      }
    });
  return { menunggu, jalankan };
}

function Area({
  id,
  nilai,
  ubah,
  baris = 4,
  petunjuk,
}: {
  id: string;
  nilai: string;
  ubah: (v: string) => void;
  baris?: number;
  petunjuk?: string;
}) {
  return (
    <textarea
      id={id}
      rows={baris}
      value={nilai}
      placeholder={petunjuk}
      onChange={(e) => ubah(e.target.value)}
      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
}

export function CatatanProses({
  kelasId,
  awal,
  terkunci,
}: {
  kelasId: string;
  awal: string;
  terkunci: boolean;
}) {
  const [teks, setTeks] = useState(awal);
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();

  if (terkunci) {
    return (
      <p className="whitespace-pre-wrap text-sm">
        {awal || (
          <span className="text-muted-foreground">
            {k.rpkps.evaluasiKelola.tidakDiisi}
          </span>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Area
        id="catatanProses"
        nilai={teks}
        ubah={setTeks}
        baris={5}
        petunjuk={k.rpkps.evaluasiKelola.catatanProsesPetunjuk}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={menunggu}
          onClick={() => jalankan(() => simpanCatatanProses(kelasId, { catatanProses: teks }))}
        >
          {k.rpkps.evaluasiKelola.simpanCatatan}
        </Button>
        <span className="text-xs text-muted-foreground">
          {isi(k.rpkps.evaluasiKelola.jumlahKarakter, { jumlah: teks.trim().length })}
        </span>
      </div>
    </div>
  );
}

export function FormulirTemuan({
  kelasId,
  tingkat,
  kode,
  awal,
  pengampu,
  tahunAkademik,
  terkunci,
}: {
  kelasId: string;
  tingkat: "SUB_CPMK" | "CPMK" | "CPL";
  kode: string;
  awal: {
    akarMasalah: string;
    tindakan: string;
    penanggungJawabId: string | null;
    taSasaranId: string | null;
  } | null;
  pengampu: { id: string; nama: string }[];
  tahunAkademik: { id: string; kode: string }[];
  terkunci: boolean;
}) {
  const [akar, setAkar] = useState(awal?.akarMasalah ?? "");
  const [tindakan, setTindakan] = useState(awal?.tindakan ?? "");
  const [pj, setPj] = useState<string | null>(awal?.penanggungJawabId ?? null);
  const [ta, setTa] = useState<string | null>(awal?.taSasaranId ?? null);
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  if (terkunci) {
    return (
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">
            {k.rpkps.evaluasiKelola.akarLabel}
          </span>{" "}
          {awal?.akarMasalah}
        </p>
        <p>
          <span className="text-muted-foreground">
            {k.rpkps.evaluasiKelola.tindakanLabel}
          </span>{" "}
          {awal?.tindakan}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`akar-${kode}`}>{k.rpkps.evaluasiKelola.akarMasalah}</Label>
        <Area
          id={`akar-${kode}`}
          nilai={akar}
          ubah={setAkar}
          baris={3}
          petunjuk={k.rpkps.evaluasiKelola.akarPetunjuk}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`tindakan-${kode}`}>{k.rpkps.evaluasiKelola.tindakan}</Label>
        <Area
          id={`tindakan-${kode}`}
          nilai={tindakan}
          ubah={setTindakan}
          baris={3}
          petunjuk={k.rpkps.evaluasiKelola.tindakanPetunjuk}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="w-56 space-y-1.5">
          <Label htmlFor={`pj-${kode}`}>{k.rpkps.evaluasiKelola.penanggungJawab}</Label>
          <Select
            value={pj ?? "__kosong__"}
            onValueChange={(v) => setPj(!v || v === "__kosong__" ? null : v)}
          >
            <SelectTrigger id={`pj-${kode}`}>
              <SelectValue placeholder={k.rpkps.evaluasiKelola.belumDitentukan} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__kosong__">
                {k.rpkps.evaluasiKelola.pilihanKosong}
              </SelectItem>
              {pengampu.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor={`ta-${kode}`}>{k.rpkps.evaluasiKelola.berlakuMulai}</Label>
          <Select
            value={ta ?? "__kosong__"}
            onValueChange={(v) => setTa(!v || v === "__kosong__" ? null : v)}
          >
            <SelectTrigger id={`ta-${kode}`}>
              <SelectValue placeholder={k.rpkps.evaluasiKelola.belumDitentukan} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__kosong__">
                {k.rpkps.evaluasiKelola.pilihanKosong}
              </SelectItem>
              {tahunAkademik.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.kode.replace("-", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        size="sm"
        disabled={menunggu}
        onClick={() =>
          jalankan(() =>
            simpanTemuan(kelasId, {
              tingkat,
              kode,
              akarMasalah: akar,
              tindakan,
              penanggungJawabId: pj,
              taSasaranId: ta,
            }),
          )
        }
      >
        {k.rpkps.evaluasiKelola.simpanTindakLanjut}
      </Button>
    </div>
  );
}

export function TombolHapusTemuan({ temuanId }: { temuanId: string }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => hapusTemuan(temuanId))}
    >
      <Trash2 />
      <span className="sr-only">{k.rpkps.evaluasiKelola.hapusTindakLanjut}</span>
    </Button>
  );
}

export function TombolTeruskan({ temuanId, sudah }: { temuanId: string; sudah: boolean }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();
  if (sudah) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={menunggu}
      onClick={() => jalankan(() => teruskanKeUsulan(temuanId))}
    >
      <Send />
      {k.rpkps.evaluasiKelola.teruskan}
    </Button>
  );
}

export function TombolPenutupan({
  kelasId,
  ditutup,
}: {
  kelasId: string;
  ditutup: boolean;
}) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return ditutup ? (
    <Button
      variant="outline"
      disabled={menunggu}
      onClick={() => jalankan(() => bukaKembali(kelasId))}
    >
      <LockOpen />
      {k.rpkps.evaluasiKelola.bukaKembali}
    </Button>
  ) : (
    <Button disabled={menunggu} onClick={() => jalankan(() => tutupEvaluasi(kelasId))}>
      <Lock />
      {k.rpkps.evaluasiKelola.tutupEvaluasi}
    </Button>
  );
}

export function Verifikasi({ temuanId }: { temuanId: string }) {
  const [catatan, setCatatan] = useState("");
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-72 space-y-1.5">
        <Label htmlFor={`verif-${temuanId}`}>
          {k.rpkps.evaluasiKelola.catatanVerifikasi}
        </Label>
        <Input
          id={`verif-${temuanId}`}
          value={catatan}
          placeholder={k.rpkps.evaluasiKelola.contohVerifikasi}
          onChange={(e) => setCatatan(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        disabled={menunggu}
        onClick={() => jalankan(() => verifikasiTemuan(temuanId, { status: "TERCAPAI", catatan }))}
      >
        <CheckCircle2 />
        {k.rpkps.evaluasiKelola.tercapai}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={menunggu}
        onClick={() =>
          jalankan(() => verifikasiTemuan(temuanId, { status: "TIDAK_TERCAPAI", catatan }))
        }
      >
        {k.rpkps.evaluasiKelola.belumTercapai}
      </Button>
    </div>
  );
}
