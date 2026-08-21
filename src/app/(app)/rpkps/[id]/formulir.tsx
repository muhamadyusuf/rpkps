"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  hapusPustaka,
  perbaruiIdentitas,
  simpanKomponenNilai,
  tambahPustaka,
  type Hasil,
} from "../aksi";

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

export function FormulirIdentitas({
  id,
  awal,
}: {
  id: string;
  awal: {
    deskripsi: string;
    kalimatPembukaCpmk: string;
    ambangKelulusanMhs: number;
    ambangKetercapaianMk: number;
    minimalKehadiranPersen: number;
  };
}) {
  const { menunggu, jalankan } = useAksi();

  return (
    <form action={(fd) => jalankan(() => perbaruiIdentitas(id, fd))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="deskripsi">Deskripsi mata kuliah</Label>
        <textarea
          id="deskripsi"
          name="deskripsi"
          rows={5}
          defaultValue={awal.deskripsi}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Mata kuliah ini memberikan pemahaman mengenai…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kalimatPembukaCpmk">Kalimat pembuka CPMK</Label>
        <Input
          id="kalimatPembukaCpmk"
          name="kalimatPembukaCpmk"
          defaultValue={awal.kalimatPembukaCpmk}
          placeholder="Setelah menyelesaikan mata kuliah ini, mahasiswa akan mampu…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ambangKelulusanMhs">Ambang kelulusan mahasiswa</Label>
          <Input
            id="ambangKelulusanMhs"
            name="ambangKelulusanMhs"
            type="number"
            step="0.01"
            defaultValue={awal.ambangKelulusanMhs}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ambangKetercapaianMk">Ambang ketercapaian MK (%)</Label>
          <Input
            id="ambangKetercapaianMk"
            name="ambangKetercapaianMk"
            type="number"
            step="0.01"
            defaultValue={awal.ambangKetercapaianMk}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minimalKehadiranPersen">Minimal kehadiran (%)</Label>
          <Input
            id="minimalKehadiranPersen"
            name="minimalKehadiranPersen"
            type="number"
            defaultValue={awal.minimalKehadiranPersen}
          />
        </div>
      </div>

      <Button type="submit" disabled={menunggu}>
        {menunggu ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}

const JENIS_PUSTAKA = [
  { nilai: "UTAMA", label: "Sumber utama" },
  { nilai: "PENDUKUNG", label: "Sumber pendukung" },
  { nilai: "DARING", label: "Sumber daring" },
  { nilai: "TOOLS", label: "Perangkat lunak / tools" },
] as const;

export function PengelolaPustaka({
  rpkpsId,
  pustaka,
}: {
  rpkpsId: string;
  pustaka: { id: string; jenis: string; nomor: number; teks: string; url: string | null }[];
}) {
  const { menunggu, jalankan } = useAksi();
  const [jenis, setJenis] = useState<string>("UTAMA");

  return (
    <div className="space-y-5">
      {JENIS_PUSTAKA.map((j) => {
        const isi = pustaka.filter((p) => p.jenis === j.nilai);
        if (isi.length === 0) return null;
        return (
          <div key={j.nilai}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {j.label}
            </p>
            <ol className="space-y-1.5">
              {isi.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                    {p.nomor}.
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.teks}
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-xs underline underline-offset-2"
                      >
                        tautan
                      </a>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Hapus pustaka"
                    disabled={menunggu}
                    onClick={() => jalankan(() => hapusPustaka(p.id))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        );
      })}

      <form
        className="flex flex-wrap items-end gap-2 border-t pt-4"
        action={(fd) => {
          const teks = String(fd.get("teks") ?? "");
          const url = String(fd.get("url") ?? "");
          jalankan(
            () =>
              tambahPustaka(
                rpkpsId,
                jenis as "UTAMA" | "PENDUKUNG" | "DARING" | "TOOLS",
                teks,
                url,
              ),
            () => {
              const form = document.getElementById("form-pustaka") as HTMLFormElement | null;
              form?.reset();
            },
          );
        }}
        id="form-pustaka"
      >
        <div className="space-y-1.5">
          <Label>Jenis</Label>
          <Select value={jenis} onValueChange={(v) => setJenis(v ?? "UTAMA")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JENIS_PUSTAKA.map((j) => (
                <SelectItem key={j.nilai} value={j.nilai}>
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="teks">Pustaka</Label>
          <Input
            id="teks"
            name="teks"
            placeholder="Silberschatz, A. (2019). Database System Concepts (7th ed.)."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">URL (opsional)</Label>
          <Input id="url" name="url" className="w-48" placeholder="https://" />
        </div>
        <Button type="submit" variant="outline" disabled={menunggu}>
          <Plus />
          Tambah
        </Button>
      </form>
    </div>
  );
}

export function PengelolaKomponenNilai({
  rpkpsId,
  awal,
}: {
  rpkpsId: string;
  awal: { nama: string; bobot: number }[];
}) {
  const { menunggu, jalankan } = useAksi();
  const [baris, setBaris] = useState(awal.length > 0 ? awal : [{ nama: "", bobot: 0 }]);

  const total = baris.reduce((s, b) => s + (Number(b.bobot) || 0), 0);
  const pas = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-3">
      {baris.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={b.nama}
            placeholder="Ujian Tengah Semester"
            onChange={(e) =>
              setBaris((d) => d.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))
            }
          />
          <Input
            type="number"
            step="0.01"
            className="w-24"
            value={b.bobot}
            onChange={(e) =>
              setBaris((d) =>
                d.map((x, j) => (j === i ? { ...x, bobot: Number(e.target.value) } : x)),
              )
            }
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hapus komponen"
            onClick={() => setBaris((d) => d.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBaris((d) => [...d, { nama: "", bobot: 0 }])}
        >
          <Plus />
          Tambah komponen
        </Button>
        <span
          className={`text-sm font-medium tabular-nums ${pas ? "text-success-foreground" : "text-destructive"}`}
        >
          Total {Math.round(total * 100) / 100}%
          {pas ? "" : " — harus 100%"}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          disabled={menunggu}
          onClick={() => jalankan(() => simpanKomponenNilai(rpkpsId, baris))}
        >
          {menunggu ? "Menyimpan…" : "Simpan komponen"}
        </Button>
      </div>
    </div>
  );
}
