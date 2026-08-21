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
import { simpanTugas, type IsiTugas } from "../aksi";

function Area({
  id,
  label,
  nilai,
  ubah,
  baris = 4,
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

export function EditorTugas({
  tugasId,
  mingguMaks,
  subCpmkTersedia,
  komponenTersedia,
  awal,
}: {
  tugasId: string;
  mingguMaks: number;
  subCpmkTersedia: { id: string; kode: string; rumusan: string }[];
  komponenTersedia: { id: string; nama: string; bobot: number }[];
  awal: IsiTugas;
}) {
  const [d, setD] = useState<IsiTugas>(awal);
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const totalKriteria = useMemo(
    () => d.kriteria.reduce((s, k) => s + (Number(k.bobot) || 0), 0),
    [d.kriteria],
  );
  const kriteriaPas = Math.abs(totalKriteria - 100) < 0.01;

  function ubah<K extends keyof IsiTugas>(kunci: K, nilai: IsiTugas[K]) {
    setD((s) => ({ ...s, [kunci]: nilai }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identitas tugas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nama">Nama tugas</Label>
            <Input
              id="nama"
              value={d.nama}
              onChange={(e) => ubah("nama", e.target.value)}
              placeholder="Proyek Akhir Basis Data"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="jenis">Jenis</Label>
              <Select
                value={d.jenis}
                onValueChange={(v) => ubah("jenis", (v ?? "INDIVIDU") as IsiTugas["jenis"])}
              >
                <SelectTrigger id="jenis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDU">Individu</SelectItem>
                  <SelectItem value="KELOMPOK">Kelompok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mingguMulai">Minggu mulai</Label>
              <Input
                id="mingguMulai"
                type="number"
                min={1}
                max={mingguMaks}
                value={d.mingguMulai}
                onChange={(e) => ubah("mingguMulai", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mingguSelesai">Minggu selesai</Label>
              <Input
                id="mingguSelesai"
                type="number"
                min={1}
                max={mingguMaks}
                value={d.mingguSelesai}
                onChange={(e) => ubah("mingguSelesai", Number(e.target.value))}
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
                {komponenTersedia.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama} ({k.bobot}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Mengaitkan bobot tugas ke komponen nilai agar tidak menjadi bobot
              ketiga yang berdiri sendiri.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sub-CPMK yang ditagih</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {subCpmkTersedia.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={d.subCpmkId.includes(s.id)}
                onChange={(e) =>
                  ubah(
                    "subCpmkId",
                    e.target.checked
                      ? [...d.subCpmkId, s.id]
                      : d.subCpmkId.filter((x) => x !== s.id),
                  )
                }
              />
              <span className="min-w-0">
                <Badge variant="outline" className="mr-1.5 font-mono text-[10px]">
                  {s.kode}
                </Badge>
                {s.rumusan}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uraian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Area
            id="deskripsi"
            label="Deskripsi tugas"
            nilai={d.deskripsi}
            ubah={(v) => ubah("deskripsi", v)}
            petunjuk="Mahasiswa diminta membangun purwarupa sistem…"
          />
          <Area
            id="uraianTugas"
            label="Uraian teknis (opsional)"
            baris={5}
            nilai={d.uraianTugas ?? ""}
            ubah={(v) => ubah("uraianTugas", v || null)}
            petunjuk={"1. Merancang ERD dan normalisasi hingga 3NF.\n2. Mengimplementasikan DDL dan DML."}
          />
          <Area
            id="formatLuaran"
            label="Format dan luaran (opsional)"
            nilai={d.formatLuaran ?? ""}
            ubah={(v) => ubah("formatLuaran", v || null)}
            petunjuk={"1. Source code (repository).\n2. Dokumentasi perancangan (PDF)."}
          />
          <Area
            id="ketentuanLain"
            label="Ketentuan lainnya (opsional)"
            baris={3}
            nilai={d.ketentuanLain ?? ""}
            ubah={(v) => ubah("ketentuanLain", v || null)}
            petunjuk="Rancangan harus orisinal dan mencantumkan sumber referensi."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indikator, kriteria, dan bobot</CardTitle>
          <CardDescription>
            Bobot di sini relatif terhadap tugas ini sendiri, bukan terhadap
            nilai akhir mata kuliah. Totalnya harus 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {d.kriteria.map((k, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <Input
                  value={k.indikator}
                  placeholder="Desain & pemodelan"
                  onChange={(e) =>
                    ubah(
                      "kriteria",
                      d.kriteria.map((x, j) =>
                        j === i ? { ...x, indikator: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  className="w-24"
                  value={k.bobot}
                  onChange={(e) =>
                    ubah(
                      "kriteria",
                      d.kriteria.map((x, j) =>
                        j === i ? { ...x, bobot: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Hapus indikator"
                  onClick={() =>
                    ubah("kriteria", d.kriteria.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="ml-7 space-y-1.5">
                {k.rincian.map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">•</span>
                    <Input
                      value={r}
                      className="h-8 text-sm"
                      placeholder="Ketepatan entitas dan kardinalitas pada ERD"
                      onChange={(e) =>
                        ubah(
                          "kriteria",
                          d.kriteria.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  rincian: x.rincian.map((y, k2) =>
                                    k2 === ri ? e.target.value : y,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Hapus rincian"
                      onClick={() =>
                        ubah(
                          "kriteria",
                          d.kriteria.map((x, j) =>
                            j === i
                              ? { ...x, rincian: x.rincian.filter((_, k2) => k2 !== ri) }
                              : x,
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    ubah(
                      "kriteria",
                      d.kriteria.map((x, j) =>
                        j === i ? { ...x, rincian: [...x.rincian, ""] } : x,
                      ),
                    )
                  }
                >
                  <Plus />
                  Rincian
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                ubah("kriteria", [...d.kriteria, { indikator: "", rincian: [], bobot: 0 }])
              }
            >
              <Plus />
              Tambah indikator
            </Button>
            <span
              className={`text-sm font-medium tabular-nums ${kriteriaPas ? "text-success" : "text-destructive"}`}
            >
              Total {Math.round(totalKriteria * 100) / 100}%
              {kriteriaPas ? "" : " — harus 100%"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linimasa</CardTitle>
          <CardDescription>Tahapan per minggu, dicetak sebagai tabel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.linimasa.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input
                type="number"
                min={1}
                max={mingguMaks}
                className="w-20"
                value={l.minggu}
                onChange={(e) =>
                  ubah(
                    "linimasa",
                    d.linimasa.map((x, j) =>
                      j === i ? { ...x, minggu: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Input
                className="w-52"
                value={l.tahapan}
                placeholder="Fase desain"
                onChange={(e) =>
                  ubah(
                    "linimasa",
                    d.linimasa.map((x, j) =>
                      j === i ? { ...x, tahapan: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                value={l.aktivitas}
                placeholder="Penyusunan business rules, ERD, dan normalisasi tabel."
                onChange={(e) =>
                  ubah(
                    "linimasa",
                    d.linimasa.map((x, j) =>
                      j === i ? { ...x, aktivitas: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus tahapan"
                onClick={() => ubah("linimasa", d.linimasa.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              ubah("linimasa", [
                ...d.linimasa,
                { minggu: d.mingguMulai, tahapan: "", aktivitas: "" },
              ])
            }
          >
            <Plus />
            Tambah tahapan
          </Button>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={menunggu}
        onClick={() =>
          mulai(async () => {
            const h = await simpanTugas(tugasId, {
              ...d,
              bobot: Number(d.bobot) || 0,
              kriteria: d.kriteria
                .filter((k) => k.indikator.trim() !== "")
                .map((k) => ({
                  ...k,
                  bobot: Number(k.bobot) || 0,
                  rincian: k.rincian.filter((r) => r.trim() !== ""),
                })),
              linimasa: d.linimasa.filter(
                (l) => l.tahapan.trim() !== "" && l.aktivitas.trim() !== "",
              ),
            });
            if (h.ok) {
              toast.success(h.pesan);
              router.refresh();
            } else toast.error(h.pesan);
          })
        }
      >
        {menunggu ? "Menyimpan…" : "Simpan tugas"}
      </Button>
    </div>
  );
}
