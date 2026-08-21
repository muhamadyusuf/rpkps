"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { LABEL_KATEGORI } from "@/domain/beban-belajar/kebijakan-bawaan";
import type { Pagu } from "@/domain/beban-belajar/tipe";
import { simpanPertemuan, type IsiPertemuan } from "../../../aksi";

type Kategori = "TM" | "PT" | "BM";

interface Props {
  pertemuanId: string;
  rpkpsId: string;
  minggu: number;
  pagu: Pagu;
  toleransiPersen: number;
  subCpmkTersedia: { id: string; kode: string; rumusan: string }[];
  komponenTersedia: { id: string; nama: string; bobot: number }[];
  pustakaTersedia: { id: string; nomor: number; jenis: string; teks: string }[];
  awal: IsiPertemuan;
}

function Area({
  id,
  label,
  nilai,
  ubah,
  baris = 3,
  petunjuk,
}: {
  id: string;
  label: string;
  nilai: string;
  ubah: (v: string) => void;
  baris?: number;
  petunjuk?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={baris}
        value={nilai}
        placeholder={petunjuk}
        onChange={(e) => ubah(e.target.value)}
        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}

export function EditorPertemuan(props: Props) {
  const { pagu, toleransiPersen } = props;
  const [d, setD] = useState<IsiPertemuan>(props.awal);
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const total = useMemo(() => {
    const per = (k: Kategori) =>
      d.aktivitas.filter((a) => a.kategori === k).reduce((s, a) => s + (Number(a.menit) || 0), 0);
    const tm = per("TM");
    const pt = per("PT");
    const bm = per("BM");
    return { tm, pt, bm, semua: tm + pt + bm };
  }, [d.aktivitas]);

  const selisih = total.semua - pagu.total;
  const persen = pagu.total > 0 ? (selisih / pagu.total) * 100 : 0;
  const pas = Math.abs(persen) <= toleransiPersen;

  function ubah<K extends keyof IsiPertemuan>(kunci: K, nilai: IsiPertemuan[K]) {
    setD((s) => ({ ...s, [kunci]: nilai }));
  }

  function simpan() {
    mulai(async () => {
      const hasil = await simpanPertemuan(props.pertemuanId, {
        ...d,
        aktivitas: d.aktivitas.map((a) => ({ ...a, menit: Number(a.menit) || 0 })),
        bobot: Number(d.bobot) || 0,
        subtopik: d.subtopik.filter((s) => s.trim() !== ""),
        indikator: d.indikator.filter((s) => s.trim() !== ""),
      });
      if (hasil.ok) {
        toast.success(hasil.pesan);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topik dan Sub-CPMK</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="topik">Topik</Label>
              <Input
                id="topik"
                value={d.topik ?? ""}
                onChange={(e) => ubah("topik", e.target.value || null)}
                placeholder="Konsep Dasar Sistem Basis Data"
              />
            </div>

            <DaftarTeks
              label="Subtopik"
              nilai={d.subtopik}
              ubah={(v) => ubah("subtopik", v)}
              petunjuk="Perbedaan dengan file system"
            />

            <div className="space-y-2">
              <Label>Sub-CPMK yang dibahas</Label>
              <div className="space-y-1.5">
                {props.subCpmkTersedia.map((s) => {
                  const terpilih = d.subCpmkId.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={terpilih}
                        onChange={(e) =>
                          ubah(
                            "subCpmkId",
                            e.target.checked
                              ? [...d.subCpmkId, s.id]
                              : d.subCpmkId.filter((x) => x !== s.id),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <Badge variant="outline" className="mr-1.5 font-mono text-[10px]">
                          {s.kode}
                        </Badge>
                        {s.rumusan}
                      </span>
                    </label>
                  );
                })}
                {props.subCpmkTersedia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Mata kuliah ini belum punya Sub-CPMK di kurikulum.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metode dan aktivitas</CardTitle>
            <CardDescription>
              Angka menit yang Anda tulis pada narasi harus sama dengan rincian
              aktivitas di panel kanan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Area
              id="metodeNarasi"
              label="Metode pembelajaran"
              baris={4}
              nilai={d.metodeNarasi ?? ""}
              ubah={(v) => ubah("metodeNarasi", v || null)}
              petunjuk={"Tatap muka (sinkron, 150 menit):\n1. Direct Instruction\n2. Diskusi kelas"}
            />
            <Area
              id="aktivitasDosen"
              label="Aktivitas dosen"
              nilai={d.aktivitasDosen ?? ""}
              ubah={(v) => ubah("aktivitasDosen", v || null)}
            />
            <Area
              id="aktivitasMahasiswa"
              label="Aktivitas mahasiswa"
              nilai={d.aktivitasMahasiswa ?? ""}
              ubah={(v) => ubah("aktivitasMahasiswa", v || null)}
            />
            <Area
              id="tugasTerstruktur"
              label="Tugas / pekerjaan terstruktur"
              nilai={d.tugasTerstruktur ?? ""}
              ubah={(v) => ubah("tugasTerstruktur", v || null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penilaian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor="penilaianJenis">Jenis penilaian</Label>
                <Input
                  id="penilaianJenis"
                  value={d.penilaianJenis ?? ""}
                  onChange={(e) => ubah("penilaianJenis", e.target.value || null)}
                  placeholder="Kuis online pada pertemuan ke-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bobot">Bobot (%)</Label>
                <Input
                  id="bobot"
                  type="number"
                  step="0.01"
                  value={d.bobot}
                  onChange={(e) => ubah("bobot", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="komponenNilaiId">Masuk ke komponen nilai</Label>
              <Select
                value={d.komponenNilaiId ?? "__kosong__"}
                onValueChange={(v) =>
                  ubah("komponenNilaiId", !v || v === "__kosong__" ? null : v)
                }
              >
                <SelectTrigger id="komponenNilaiId">
                  <SelectValue placeholder="Belum ditentukan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__kosong__">— belum ditentukan —</SelectItem>
                  {props.komponenTersedia.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.nama} ({k.bobot}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Menentukan tanda centang pada tabel distribusi penilaian di
                dokumen RPKPS.
              </p>
            </div>

            <Area
              id="penilaianSistem"
              label="Sistem penilaian"
              baris={2}
              nilai={d.penilaianSistem ?? ""}
              ubah={(v) => ubah("penilaianSistem", v || null)}
              petunjuk="Ketepatan dalam menjawab butir pertanyaan"
            />

            <DaftarTeks
              label="Indikator"
              nilai={d.indikator}
              ubah={(v) => ubah("indikator", v)}
              petunjuk="Mahasiswa mampu mendefinisikan sistem basis data"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referensi</CardTitle>
          </CardHeader>
          <CardContent>
            {props.pustakaTersedia.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada pustaka. Tambahkan lebih dulu di halaman RPKPS.
              </p>
            ) : (
              <div className="space-y-1.5">
                {props.pustakaTersedia.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={d.pustakaId.includes(p.id)}
                      onChange={(e) =>
                        ubah(
                          "pustakaId",
                          e.target.checked
                            ? [...d.pustakaId, p.id]
                            : d.pustakaId.filter((x) => x !== p.id),
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-muted-foreground">[{p.nomor}]</span> {p.teks}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neraca waktu</CardTitle>
            <CardDescription>Minggu {props.minggu}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Terpakai</span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    pas ? "text-success-foreground" : "text-destructive"
                  }`}
                >
                  {formatMenit(total.semua)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Pagu</span>
                <span className="tabular-nums">{formatMenit(pagu.total)}</span>
              </div>
              {pagu.total > 0 ? (
                <p
                  className={`mt-2 text-xs ${pas ? "text-muted-foreground" : "font-medium text-destructive"}`}
                >
                  {selisih === 0
                    ? "Pas dengan pagu."
                    : `${selisih > 0 ? "Lebih" : "Kurang"} ${formatMenit(Math.abs(selisih))} (${Math.abs(Math.round(persen * 10) / 10)}%)`}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 text-xs">
              {(["TM", "PT", "BM"] as Kategori[]).map((k) => {
                const nilai = k === "TM" ? total.tm : k === "PT" ? total.pt : total.bm;
                const paguK = k === "TM" ? pagu.tm : k === "PT" ? pagu.pt : pagu.bm;
                const lebih = nilai > paguK;
                return (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{LABEL_KATEGORI[k]}</span>
                    <span className={`tabular-nums ${lebih ? "font-medium text-destructive" : ""}`}>
                      {nilai}′ / {paguK}′
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Rincian aktivitas</Label>
              {d.aktivitas.map((a, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border p-2">
                  <Input
                    value={a.nama}
                    placeholder="Nama aktivitas"
                    className="h-7 text-xs"
                    onChange={(e) =>
                      ubah(
                        "aktivitas",
                        d.aktivitas.map((x, j) =>
                          j === i ? { ...x, nama: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={a.kategori}
                      onValueChange={(v) =>
                        ubah(
                          "aktivitas",
                          d.aktivitas.map((x, j) =>
                            j === i ? { ...x, kategori: (v ?? "TM") as Kategori } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-7 w-16 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TM">TM</SelectItem>
                        <SelectItem value="PT">PT</SelectItem>
                        <SelectItem value="BM">BM</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={a.menit}
                      className="h-7 w-16 text-xs"
                      onChange={(e) =>
                        ubah(
                          "aktivitas",
                          d.aktivitas.map((x, j) =>
                            j === i ? { ...x, menit: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                    <span className="text-xs text-muted-foreground">′</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Hapus aktivitas"
                      className="ml-auto"
                      onClick={() =>
                        ubah("aktivitas", d.aktivitas.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  ubah("aktivitas", [
                    ...d.aktivitas,
                    { nama: "", kategori: "BM" as Kategori, menit: 0 },
                  ])
                }
              >
                <Plus />
                Aktivitas
              </Button>
            </div>

            <Button className="w-full" disabled={menunggu} onClick={simpan}>
              {menunggu ? "Menyimpan…" : "Simpan minggu ini"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DaftarTeks({
  label,
  nilai,
  ubah,
  petunjuk,
}: {
  label: string;
  nilai: string[];
  ubah: (v: string[]) => void;
  petunjuk?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {nilai.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <Input
            value={t}
            placeholder={petunjuk}
            onChange={(e) => ubah(nilai.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus ${label.toLowerCase()}`}
            onClick={() => ubah(nilai.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => ubah([...nilai, ""])}>
        <Plus />
        Tambah {label.toLowerCase()}
      </Button>
    </div>
  );
}
