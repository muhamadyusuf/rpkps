"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { LEVEL_BLOOM, type LevelBloom } from "@/domain/kurikulum/bloom";
import {
  validasiKisiKisi,
  type KonteksKisiKisi,
} from "@/domain/rpkps/kisi-kisi";
import { simpanKisiKisi, type IsiKisiKisi } from "./aksi";

const BENTUK = [
  ["ESAI", "Esai"],
  ["PILIHAN_GANDA", "Pilihan ganda"],
  ["URAIAN_SINGKAT", "Uraian singkat"],
  ["STUDI_KASUS", "Studi kasus"],
  ["PRAKTIK", "Praktik"],
  ["PROYEK", "Proyek"],
  ["LISAN", "Lisan"],
] as const;

export function EditorKisiKisi({
  rpkpsId,
  jenis,
  subCpmkTersedia,
  konteks,
  awal,
}: {
  rpkpsId: string;
  jenis: "UTS" | "UAS";
  subCpmkTersedia: { id: string; kode: string; rumusan: string }[];
  konteks: KonteksKisiKisi;
  awal: IsiKisiKisi;
}) {
  const [d, setD] = useState<IsiKisiKisi>(awal);
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const petaKode = useMemo(
    () => new Map(subCpmkTersedia.map((s) => [s.id, s.kode])),
    [subCpmkTersedia],
  );

  const hasil = useMemo(
    () =>
      validasiKisiKisi(
        {
          jenis,
          totalSkor: Number(d.totalSkor) || 0,
          butir: d.butir.map((b, i) => ({
            nomor: i + 1,
            subCpmkKode: petaKode.get(b.subCpmkId) ?? "?",
            levelBloom: b.levelBloom as LevelBloom,
            jumlahButir: Number(b.jumlahButir) || 0,
            skor: Number(b.skor) || 0,
          })),
        },
        konteks,
      ),
    [d, jenis, konteks, petaKode],
  );

  function ubah<K extends keyof IsiKisiKisi>(kunci: K, nilai: IsiKisiKisi[K]) {
    setD((s) => ({ ...s, [kunci]: nilai }));
  }

  function ubahButir(i: number, patch: Partial<IsiKisiKisi["butir"][number]>) {
    ubah("butir", d.butir.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`total-${jenis}`}>Total skor</Label>
          <Input
            id={`total-${jenis}`}
            type="number"
            step="0.01"
            value={d.totalSkor}
            onChange={(e) => ubah("totalSkor", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`durasi-${jenis}`}>Durasi (menit)</Label>
          <Input
            id={`durasi-${jenis}`}
            type="number"
            value={d.durasiMenit ?? ""}
            onChange={(e) =>
              ubah("durasiMenit", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`catatan-${jenis}`}>Catatan</Label>
          <Input
            id={`catatan-${jenis}`}
            value={d.catatan ?? ""}
            placeholder="Open book, boleh membawa satu lembar catatan"
            onChange={(e) => ubah("catatan", e.target.value || null)}
          />
        </div>
      </div>

      <div className="space-y-2">
        {d.butir.map((b, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
                {i + 1}.
              </span>
              <Select
                value={b.subCpmkId}
                onValueChange={(v) => ubahButir(i, { subCpmkId: v ?? "" })}
              >
                <SelectTrigger className="min-w-44 flex-1">
                  <SelectValue placeholder="Pilih Sub-CPMK" />
                </SelectTrigger>
                <SelectContent>
                  {subCpmkTersedia.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.kode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={b.levelBloom}
                onValueChange={(v) =>
                  ubahButir(i, { levelBloom: (v ?? "C3") as IsiKisiKisi["butir"][number]["levelBloom"] })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_BLOOM.map((l) => (
                    <SelectItem key={l.level} value={l.level}>
                      {l.level} · {l.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={b.bentuk}
                onValueChange={(v) =>
                  ubahButir(i, { bentuk: (v ?? "ESAI") as IsiKisiKisi["butir"][number]["bentuk"] })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENTUK.map(([nilai, label]) => (
                    <SelectItem key={nilai} value={nilai}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-20"
                title="Jumlah butir"
                value={b.jumlahButir}
                onChange={(e) => ubahButir(i, { jumlahButir: Number(e.target.value) })}
              />
              <Input
                type="number"
                step="0.01"
                className="w-20"
                title="Skor"
                value={b.skor}
                onChange={(e) => ubahButir(i, { skor: Number(e.target.value) })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus butir"
                onClick={() => ubah("butir", d.butir.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <Input
              className="ml-7 h-8 text-sm"
              placeholder="Indikator soal (opsional)"
              value={b.indikator ?? ""}
              onChange={(e) => ubahButir(i, { indikator: e.target.value || null })}
            />
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            ubah("butir", [
              ...d.butir,
              {
                subCpmkId: subCpmkTersedia[0]?.id ?? "",
                levelBloom: "C3" as const,
                bentuk: "ESAI" as const,
                jumlahButir: 1,
                skor: 0,
                indikator: null,
              },
            ])
          }
        >
          <Plus />
          Tambah butir
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Angka
          label="Total skor"
          nilai={`${hasil.ringkasan.totalSkor}`}
          nada={
            Math.abs(hasil.ringkasan.totalSkor - Number(d.totalSkor)) < 0.01
              ? "baik"
              : "buruk"
          }
        />
        <Angka label="Jumlah butir soal" nilai={`${hasil.ringkasan.jumlahButir}`} />
        <Angka
          label="Sub-CPMK tercakup"
          nilai={`${hasil.ringkasan.subCpmkTercakup} / ${hasil.ringkasan.subCpmkSeharusnya}`}
          nada={
            hasil.ringkasan.subCpmkTercakup >= hasil.ringkasan.subCpmkSeharusnya
              ? "baik"
              : "buruk"
          }
        />
      </div>

      {hasil.temuan.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p>Kisi-kisi {jenis} lolos seluruh pemeriksaan.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {hasil.temuan.map((t, i) => (
            <li
              key={i}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                t.tingkat === "PEMBLOKIR"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-warning/40 bg-warning/10"
              }`}
            >
              {t.tingkat === "PEMBLOKIR" ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              )}
              <div className="min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground">{t.kode}</span>
                <p>{t.pesan}</p>
                {t.saran ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">↳ {t.saran}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        disabled={menunggu}
        onClick={() =>
          mulai(async () => {
            const h = await simpanKisiKisi(rpkpsId, jenis, {
              ...d,
              totalSkor: Number(d.totalSkor) || 0,
              butir: d.butir
                .filter((b) => b.subCpmkId)
                .map((b) => ({
                  ...b,
                  jumlahButir: Number(b.jumlahButir) || 1,
                  skor: Number(b.skor) || 0,
                })),
            });
            if (h.ok) {
              toast.success(h.pesan);
              router.refresh();
            } else toast.error(h.pesan);
          })
        }
      >
        {menunggu ? "Menyimpan…" : `Simpan kisi-kisi ${jenis}`}
      </Button>
    </div>
  );
}

function Angka({
  label,
  nilai,
  nada,
}: {
  label: string;
  nilai: string;
  nada?: "baik" | "buruk";
}) {
  const warna =
    nada === "baik" ? "text-success" : nada === "buruk" ? "text-destructive" : "";
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p
        className={`mt-1.5 font-mono text-lg leading-none font-semibold tabular-nums ${warna}`}
      >
        {nilai}
      </p>
    </div>
  );
}

export function PanelKosong({ jenis }: { jenis: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kisi-kisi {jenis}</CardTitle>
        <CardDescription>
          Belum ada butir. Tambahkan agar tiap Sub-CPMK yang diajarkan benar-benar diuji.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="outline">belum disusun</Badge>
      </CardContent>
    </Card>
  );
}
