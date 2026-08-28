"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Plug, Power, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
        toast.error(h.pesan);
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
  const [menguji, mulaiUji] = useTransition();
  const [kode, setKode] = useState<Penyedia>(penyedia[0]?.kode ?? "ANTHROPIC");
  const [label, setLabel] = useState("Kunci pribadi saya");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const info = penyedia.find((p) => p.kode === kode);
  const siap = apiKey.trim().length >= 16 && label.trim().length >= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tambahkan kunci</CardTitle>
        <CardDescription>
          {info ? `Buat kunci di ${info.asal}, lalu tempelkan di sini.` : null} Kunci
          disimpan terenkripsi dan <strong>tidak dapat dibaca kembali</strong> — hanya
          diganti.
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
              <Label htmlFor="penyedia">Penyedia AI</Label>
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
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Kunci pribadi saya"
              />
              <p className="text-xs text-muted-foreground">
                Label yang sama pada penyedia yang sama berarti mengganti kunci
                lama, bukan menambah baris baru.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API key</Label>
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
            <Label htmlFor="model">Model (opsional)</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={info?.modelBawaan ?? ""}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Kosongkan untuk memakai {info?.modelBawaan ?? "model bawaan"}. Nama
              model melekat pada kunci ini karena tidak pernah cocok antar penyedia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button type="submit" disabled={!siap || menunggu || menguji}>
              <KeyRound />
              {menunggu ? "Menguji lalu menyimpan…" : "Uji lalu simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!siap || menunggu || menguji}
              onClick={() =>
                mulaiUji(async () => {
                  const h = await ujiKunciBaru(kode, apiKey, model.trim() || null);
                  if (h.ok) toast.success(h.pesan);
                  else toast.error(h.pesan);
                })
              }
            >
              <Plug />
              {menguji ? "Menguji…" : "Uji koneksi saja"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Kunci hanya tersimpan bila uji koneksinya berhasil.
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

  if (kunci.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Belum ada kunci tersimpan</CardTitle>
          <CardDescription>
            Selama belum ada kunci, tombol AI pada penyusun RPKPS dan impor
            kurikulum tidak dapat dijalankan. Aplikasi ini tidak menyediakan
            kunci bersama — setiap dosen memakai dan menanggung kuncinya sendiri.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kunci tersimpan ({kunci.length})</CardTitle>
        <CardDescription>
          Kunci bawaan dipakai tombol AI tanpa bertanya. Empat karakter terakhir
          ditampilkan agar Anda dapat mengenali kuncinya — bukan memakainya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {kunci.map((k) => (
            <li key={k.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{labelPenyedia[k.penyedia]}</span>
                <span className="text-sm text-muted-foreground">· {k.label}</span>
                <span className="font-mono text-xs text-muted-foreground">…{k.ekor}</span>
                {k.bawaan ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Bawaan
                  </Badge>
                ) : null}
                {!k.aktif ? (
                  <Badge variant="outline" className="text-[10px]">
                    Nonaktif
                  </Badge>
                ) : null}
              </div>

              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {k.modelEfektif}
                {k.model === null ? " (bawaan penyedia)" : ""}
                {k.terakhirDipakai
                  ? ` · terakhir dipakai ${k.terakhirDipakai.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}`
                  : " · belum pernah dipakai"}
              </p>

              <div className="mt-2 flex flex-wrap gap-1">
                {!k.bawaan && k.aktif ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={menunggu}
                    onClick={() => jalankan(() => pilihBawaan(k.id))}
                  >
                    <Star />
                    Jadikan bawaan
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={menunggu}
                  onClick={() => jalankan(() => setelAktif(k.id, !k.aktif))}
                >
                  {k.aktif ? <Power /> : <CheckCircle2 />}
                  {k.aktif ? "Nonaktifkan" : "Aktifkan"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={menunggu}
                  onClick={() => jalankan(() => buangKunci(k.id))}
                >
                  <Trash2 />
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
