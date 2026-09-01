"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Plug, Power, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { tanggal } from "@/lib/bahasa/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  buangKunci,
  pilihBawaan,
  setelAktif,
  tambahKunci,
  ujiKunciBaru,
  type Hasil,
} from "./aksi";

type Penyedia = "ANTHROPIC" | "MISTRAL" | "GEMINI";

export type KunciTersimpan = {
  id: string;
  penyedia: Penyedia;
  label: string;
  ekor: string;
  model: string | null;
  modelEfektif: string;
  bawaan: boolean;
  aktif: boolean;
  terakhirDipakai: Date | null;
};

export type InfoPenyedia = {
  kode: Penyedia;
  label: string;
  asal: string;
  modelBawaan: string;
};

/**
 * Galat kunci AI kini memuat diagnosis — alasan asli penyedia dan daftar model
 * yang boleh dipakai kunci ini. Empat detik bawaan Sonner tidak cukup untuk
 * membacanya, apalagi menyalin nama model darinya, jadi toast galat di halaman
 * ini bertahan sampai ditutup sendiri.
 */
const TOAST_GALAT = { duration: 20_000 } as const;

function useAksi() {
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
        toast.error(h.pesan, TOAST_GALAT);
      }
    });
  return { menunggu, jalankan };
}

/**
 * Formulir penambahan kunci.
 *
 * Uji koneksi WAJIB berhasil sebelum simpan (docs/01 §2.2) — dan itu ditegakkan
 * di server, bukan hanya oleh tombol di sini: `simpanKredensial` menjalankan
 * ujinya sendiri. Tombol "Uji koneksi" semata memberi dosen jawaban lebih cepat
 * sebelum ia mengisi sisa formulir.
 */
export function FormulirKunci({ penyedia }: { penyedia: InfoPenyedia[] }) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const [menguji, mulaiUji] = useTransition();
  const [kode, setKode] = useState<Penyedia>(penyedia[0]?.kode ?? "ANTHROPIC");
  // Label berisi lebih dulu, seperti sebelumnya: `siap` mensyaratkan minimal
  // dua huruf, jadi memulainya kosong akan mematikan tombol simpan sampai
  // dosen mengetik sesuatu yang sebetulnya tidak perlu ia pikirkan.
  const [label, setLabel] = useState(k.kunciAi.formulir.labelBawaan);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const info = penyedia.find((p) => p.kode === kode);
  const siap = apiKey.trim().length >= 16 && label.trim().length >= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.kunciAi.formulir.judul}</CardTitle>
        <CardDescription>
          {info ? isi(k.kunciAi.formulir.asal, { asal: info.asal }) : null}
          {k.kunciAi.formulir.keteranganAwal}
          <strong>{k.kunciAi.formulir.keteranganTebal}</strong>
          {k.kunciAi.formulir.keteranganAkhir}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!siap) return;
            const data = new FormData();
            data.set("penyedia", kode);
            data.set("label", label.trim());
            data.set("apiKey", apiKey.trim());
            data.set("model", model.trim());
            jalankan(
              () => tambahKunci(data),
              () => {
                setApiKey("");
                setModel("");
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="penyedia">{k.kunciAi.formulir.penyedia}</Label>
              <Select value={kode} onValueChange={(v) => setKode((v as Penyedia) ?? kode)}>
                <SelectTrigger id="penyedia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {penyedia.map((p) => (
                    <SelectItem key={p.kode} value={p.kode}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label">{k.kunciAi.formulir.label}</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={k.kunciAi.formulir.labelBawaan}
              />
              <p className="text-xs text-muted-foreground">
                {k.kunciAi.formulir.labelPetunjuk}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apiKey">{k.kunciAi.formulir.apiKey}</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model">{k.kunciAi.formulir.model}</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={info?.modelBawaan ?? ""}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {isi(k.kunciAi.formulir.modelPetunjuk, {
                model: info?.modelBawaan ?? k.kunciAi.formulir.modelBawaanUmum,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button type="submit" disabled={!siap || menunggu || menguji}>
              <KeyRound />
              {menunggu
                ? k.kunciAi.formulir.mengujiMenyimpan
                : k.kunciAi.formulir.ujiSimpan}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!siap || menunggu || menguji}
              onClick={() =>
                mulaiUji(async () => {
                  const h = await ujiKunciBaru(kode, apiKey, model.trim() || null);
                  if (h.ok) toast.success(h.pesan);
                  else toast.error(h.pesan, TOAST_GALAT);
                })
              }
            >
              <Plug />
              {menguji ? k.kunciAi.formulir.menguji : k.kunciAi.formulir.ujiSaja}
            </Button>
            <p className="text-xs text-muted-foreground">
              {k.kunciAi.formulir.catatanUji}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function DaftarKunci({
  kunci,
  labelPenyedia,
}: {
  kunci: KunciTersimpan[];
  labelPenyedia: Record<Penyedia, string>;
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi, bahasa } = useBahasa();

  if (kunci.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kunciAi.daftar.kosongJudul}</CardTitle>
          <CardDescription>{k.kunciAi.daftar.kosongIsi}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isi(k.kunciAi.daftar.judul, { jumlah: kunci.length })}
        </CardTitle>
        <CardDescription>{k.kunciAi.daftar.keterangan}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {kunci.map((baris) => (
            <li key={baris.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {labelPenyedia[baris.penyedia]}
                </span>
                <span className="text-sm text-muted-foreground">· {baris.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  …{baris.ekor}
                </span>
                {baris.bawaan ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {k.kunciAi.daftar.bawaan}
                  </Badge>
                ) : null}
                {!baris.aktif ? (
                  <Badge variant="outline" className="text-[10px]">
                    {k.kunciAi.daftar.nonaktif}
                  </Badge>
                ) : null}
              </div>

              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {baris.modelEfektif}
                {baris.model === null ? k.kunciAi.daftar.modelBawaanPenyedia : ""}
                {baris.terakhirDipakai
                  ? isi(k.kunciAi.daftar.terakhirDipakai, {
                      tanggal: tanggal(baris.terakhirDipakai, bahasa, "pendek"),
                    })
                  : k.kunciAi.daftar.belumPernahDipakai}
              </p>

              <div className="mt-2 flex flex-wrap gap-1">
                {!baris.bawaan && baris.aktif ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={menunggu}
                    onClick={() => jalankan(() => pilihBawaan(baris.id))}
                  >
                    <Star />
                    {k.kunciAi.daftar.jadikanBawaan}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={menunggu}
                  onClick={() => jalankan(() => setelAktif(baris.id, !baris.aktif))}
                >
                  {baris.aktif ? <Power /> : <CheckCircle2 />}
                  {baris.aktif
                    ? k.kunciAi.daftar.nonaktifkan
                    : k.kunciAi.daftar.aktifkan}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={menunggu}
                  onClick={() => jalankan(() => buangKunci(baris.id))}
                >
                  <Trash2 />
                  {k.kunciAi.daftar.hapus}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
