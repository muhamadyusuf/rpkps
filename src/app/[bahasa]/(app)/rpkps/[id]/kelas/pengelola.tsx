"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
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
import { teksTemuan } from "@/lib/bahasa/temuan";

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

  const { k } = useBahasa();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-28 space-y-1.5">
        <Label htmlFor="kodeKelas">{k.rpkps.kelasKelola.kodeKelas}</Label>
        <Input
          id="kodeKelas"
          value={kode}
          placeholder={k.rpkps.kelasKelola.contohKode}
          onChange={(e) => setKode(e.target.value)}
        />
      </div>
      <div className="w-60 space-y-1.5">
        <Label htmlFor="dosenKelas">{k.rpkps.kelasKelola.dosenKelas}</Label>
        <Select
          value={dosenId ?? "__kosong__"}
          onValueChange={(v) => setDosenId(!v || v === "__kosong__" ? null : v)}
        >
          <SelectTrigger id="dosenKelas">
            <SelectValue placeholder={k.rpkps.kelasKelola.belumDitentukan} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__kosong__">{k.rpkps.kelasKelola.pilihanKosong}</SelectItem>
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
        {k.rpkps.kelasKelola.tambahKelas}
      </Button>
    </div>
  );
}

export function TombolHapusKelas({ kelasId, kode }: { kelasId: string; kode: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k, isi } = useBahasa();

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
      <span className="sr-only">
        {isi(k.rpkps.kelasKelola.hapusKelas, { kode })}
      </span>
    </Button>
  );
}

export function UnggahNilai({ kelasId }: { kelasId: string }) {
  const masukan = useRef<HTMLInputElement>(null);
  const [menunggu, mulai] = useTransition();
  const [hasil, setHasil] = useState<HasilUnggah | null>(null);
  const router = useRouter();
  const { k, isi } = useBahasa();

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
          {menunggu
            ? k.rpkps.kelasKelola.membacaBerkas
            : k.rpkps.kelasKelola.unggahNilai}
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
                {teksTemuan(t, k).pesan}
              </span>
            </li>
          ))}
          {hasil.temuan.length > 12 ? (
            <li className="text-xs text-muted-foreground">
              {isi(k.rpkps.kelasKelola.temuanLain, {
                jumlah: hasil.temuan.length - 12,
              })}
            </li>
          ) : null}
        </ul>
      ) : null}

      {hasil?.ok && hasil.ringkasan ? (
        <p className="text-sm text-muted-foreground">
          {isi(k.rpkps.kelasKelola.ringkasUnggah, {
            terisi: hasil.ringkasan.selTerisi,
            seluruh: hasil.ringkasan.selSeluruh,
            persen: hasil.ringkasan.persenLengkap,
          })}
          {hasil.ringkasan.pesertaBaru > 0
            ? isi(k.rpkps.kelasKelola.pesertaBaru, {
                jumlah: hasil.ringkasan.pesertaBaru,
              })
            : ""}
          {hasil.ringkasan.tidakDiberkas > 0
            ? isi(k.rpkps.kelasKelola.tidakDiberkas, {
                jumlah: hasil.ringkasan.tidakDiberkas,
              })
            : ""}
        </p>
      ) : null}
    </div>
  );
}
