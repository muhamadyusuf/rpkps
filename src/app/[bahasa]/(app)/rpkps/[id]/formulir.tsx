"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
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
  const { k } = useBahasa();

  return (
    <form action={(fd) => jalankan(() => perbaruiIdentitas(id, fd))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="deskripsi">{k.rpkps.identitas.deskripsi}</Label>
        <textarea
          id="deskripsi"
          name="deskripsi"
          rows={5}
          defaultValue={awal.deskripsi}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder={k.rpkps.identitas.contohDeskripsi}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kalimatPembukaCpmk">{k.rpkps.identitas.kalimatPembuka}</Label>
        <Input
          id="kalimatPembukaCpmk"
          name="kalimatPembukaCpmk"
          defaultValue={awal.kalimatPembukaCpmk}
          placeholder={k.rpkps.identitas.contohKalimatPembuka}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ambangKelulusanMhs">{k.rpkps.identitas.ambangKelulusan}</Label>
          <Input
            id="ambangKelulusanMhs"
            name="ambangKelulusanMhs"
            type="number"
            step="0.01"
            defaultValue={awal.ambangKelulusanMhs}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ambangKetercapaianMk">
            {k.rpkps.identitas.ambangKetercapaian}
          </Label>
          <Input
            id="ambangKetercapaianMk"
            name="ambangKetercapaianMk"
            type="number"
            step="0.01"
            defaultValue={awal.ambangKetercapaianMk}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minimalKehadiranPersen">
            {k.rpkps.identitas.minimalKehadiran}
          </Label>
          <Input
            id="minimalKehadiranPersen"
            name="minimalKehadiranPersen"
            type="number"
            defaultValue={awal.minimalKehadiranPersen}
          />
        </div>
      </div>

      <Button type="submit" disabled={menunggu}>
        {menunggu ? k.rpkps.identitas.menyimpan : k.rpkps.identitas.simpan}
      </Button>
    </form>
  );
}

const JENIS_PUSTAKA = [
  { nilai: "UTAMA" },
  { nilai: "PENDUKUNG" },
  { nilai: "DARING" },
  { nilai: "TOOLS" },
] as const;

export function PengelolaPustaka({
  rpkpsId,
  pustaka,
}: {
  rpkpsId: string;
  pustaka: { id: string; jenis: string; nomor: number; teks: string; url: string | null }[];
}) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();
  const [jenis, setJenis] = useState<string>("UTAMA");

  return (
    <div className="space-y-5">
      {JENIS_PUSTAKA.map((j) => {
        const daftar = pustaka.filter((p) => p.jenis === j.nilai);
        if (daftar.length === 0) return null;
        return (
          <div key={j.nilai}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.enum.jenisPustaka[j.nilai]}
            </p>
            <ol className="space-y-1.5">
              {daftar.map((p) => (
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
                        {k.rpkps.pustaka.tautan}
                      </a>
                    ) : null}
                  </span>
                  <TombolIkon
                    size="icon-xs"
                    petunjuk={k.rpkps.pustaka.hapus}
                    disabled={menunggu}
                    onClick={() => jalankan(() => hapusPustaka(p.id))}
                  >
                    <Trash2 />
                  </TombolIkon>
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
          <Label>{k.rpkps.pustaka.jenis}</Label>
          <Select value={jenis} onValueChange={(v) => setJenis(v ?? "UTAMA")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JENIS_PUSTAKA.map((j) => (
                <SelectItem key={j.nilai} value={j.nilai}>
                  {k.enum.jenisPustaka[j.nilai]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="teks">{k.rpkps.pustaka.pustaka}</Label>
          <Input
            id="teks"
            name="teks"
            placeholder={k.rpkps.pustaka.contohPustaka}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">{k.rpkps.pustaka.url}</Label>
          <Input id="url" name="url" className="w-48" placeholder="https://" />
        </div>
        <Button type="submit" variant="outline" disabled={menunggu}>
          <Plus />
          {k.rpkps.pustaka.tambah}
        </Button>
      </form>
    </div>
  );
}

/**
 * Tiap baris membawa id komponennya — null untuk yang baru ditambahkan.
 *
 * Id itu satu-satunya cara server membedakan "komponen ini berganti nama" dari
 * "komponen lama dibuang, komponen baru ditambahkan". Tanpa itu, penyimpanan
 * melepaskan tautan seluruh baris mingguan dan lembar tugas.
 */
type BarisKomponen = { id: string | null; nama: string; bobot: number };

export function PengelolaKomponenNilai({
  rpkpsId,
  awal,
}: {
  rpkpsId: string;
  awal: BarisKomponen[];
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const [baris, setBaris] = useState<BarisKomponen[]>(
    awal.length > 0 ? awal : [{ id: null, nama: "", bobot: 0 }],
  );

  const total = baris.reduce((s, b) => s + (Number(b.bobot) || 0), 0);
  const pas = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-3">
      {baris.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={b.nama}
            placeholder={k.rpkps.komponen.contohNama}
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
          <TombolIkon
            petunjuk={k.rpkps.komponen.hapus}
            onClick={() => setBaris((d) => d.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </TombolIkon>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBaris((d) => [...d, { id: null, nama: "", bobot: 0 }])}
        >
          <Plus />
          {k.rpkps.komponen.tambah}
        </Button>
        <span
          className={`text-sm font-medium tabular-nums ${pas ? "text-success-foreground" : "text-destructive"}`}
        >
          {isi(k.rpkps.komponen.total, { nilai: Math.round(total * 100) / 100 })}
          {pas ? "" : k.rpkps.komponen.harus100}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          disabled={menunggu}
          onClick={() => jalankan(() => simpanKomponenNilai(rpkpsId, baris))}
        >
          {menunggu ? k.rpkps.identitas.menyimpan : k.rpkps.komponen.simpan}
        </Button>
      </div>
    </div>
  );
}
