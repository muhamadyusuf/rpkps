"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
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
import { buatKelas, hapusKelas, unggahNilai, type HasilUnggah } from "./aksi";

export function FormulirKelas({
  rpkpsId,
  pengampu,
}: {
  rpkpsId: string;
  pengampu: { id: string; nama: string }[];
}) {
  const [kode, setKode] = useState("");
  const [dosenId, setDosenId] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const kirim = () =>
    mulai(async () => {
      const h = await buatKelas(rpkpsId, { kode, dosenId });
      if (h.ok) {
        toast.success(h.pesan);
        setKode("");
        setDosenId(null);
        router.refresh();
      } else {
        toast.error(h.pesan);
      }
    });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-28 space-y-1.5">
        <Label htmlFor="kodeKelas">Kode kelas</Label>
        <Input
          id="kodeKelas"
          value={kode}
          placeholder="A"
          onChange={(e) => setKode(e.target.value)}
        />
      </div>
      <div className="w-60 space-y-1.5">
        <Label htmlFor="dosenKelas">Dosen pengampu kelas</Label>
        <Select
          value={dosenId ?? "__kosong__"}
          onValueChange={(v) => setDosenId(!v || v === "__kosong__" ? null : v)}
        >
          <SelectTrigger id="dosenKelas">
            <SelectValue placeholder="Belum ditentukan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__kosong__">— belum ditentukan —</SelectItem>
            {pengampu.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={kirim} disabled={menunggu || kode.trim() === ""}>
        <Plus />
        Tambah kelas
      </Button>
    </div>
  );
}

export function TombolHapusKelas({ kelasId, kode }: { kelasId: string; kode: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={menunggu}
      onClick={() =>
        mulai(async () => {
          const h = await hapusKelas(kelasId);
          if (h.ok) {
            toast.success(h.pesan);
            router.refresh();
          } else {
            toast.error(h.pesan);
          }
        })
      }
    >
      <Trash2 />
      <span className="sr-only">Hapus kelas {kode}</span>
    </Button>
  );
}

export function UnggahNilai({ kelasId }: { kelasId: string }) {
  const masukan = useRef<HTMLInputElement>(null);
  const [menunggu, mulai] = useTransition();
  const [hasil, setHasil] = useState<HasilUnggah | null>(null);
  const router = useRouter();

  const kirim = (berkas: File) =>
    mulai(async () => {
      const data = new FormData();
      data.set("berkas", berkas);
      const h = await unggahNilai(kelasId, data);
      setHasil(h);
      if (h.ok) {
        toast.success(h.pesan);
        router.refresh();
      } else {
        toast.error(h.pesan);
      }
      if (masukan.current) masukan.current.value = "";
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={masukan}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const berkas = e.target.files?.[0];
            if (berkas) kirim(berkas);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={menunggu}
          onClick={() => masukan.current?.click()}
        >
          <Upload />
          {menunggu ? "Membaca berkas…" : "Unggah nilai"}
        </Button>
      </div>

      {hasil?.temuan && hasil.temuan.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {hasil.temuan.slice(0, 12).map((t, i) => (
            <li key={`${t.kode}-${i}`} className="flex items-start gap-2">
              <span
                className={`mt-1 size-1.5 shrink-0 rounded-full ${
                  t.tingkat === "PEMBLOKIR" ? "bg-destructive" : "bg-warning"
                }`}
              />
              <span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t.kode}
                </span>{" "}
                {t.pesan}
              </span>
            </li>
          ))}
          {hasil.temuan.length > 12 ? (
            <li className="text-xs text-muted-foreground">
              …dan {hasil.temuan.length - 12} temuan lain.
            </li>
          ) : null}
        </ul>
      ) : null}

      {hasil?.ok && hasil.ringkasan ? (
        <p className="text-sm text-muted-foreground">
          {hasil.ringkasan.selTerisi} dari {hasil.ringkasan.selSeluruh} sel terisi (
          {hasil.ringkasan.persenLengkap}%)
          {hasil.ringkasan.pesertaBaru > 0
            ? ` · ${hasil.ringkasan.pesertaBaru} peserta baru`
            : ""}
          {hasil.ringkasan.tidakDiberkas > 0
            ? ` · ${hasil.ringkasan.tidakDiberkas} peserta lama tidak ada di berkas dan dibiarkan`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
