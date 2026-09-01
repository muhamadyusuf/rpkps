"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { TombolIkon } from "@/components/tombol-ikon";
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
import { Medan, SakelarBahasa, type ModeBahasa } from "@/components/dwibahasa";

export function EditorTugas({
  tugasId,
  capVersi,
  mingguMaks,
  subCpmkTersedia,
  komponenTersedia,
  awal,
}: {
  tugasId: string;
  /** Cap `diubahPada` lembar ini saat halaman digambar — lihat EditorPertemuan. */
  capVersi: string;
  mingguMaks: number;
  subCpmkTersedia: { id: string; kode: string; rumusan: string }[];
  komponenTersedia: { id: string; nama: string; bobot: number }[];
  awal: IsiTugas;
}) {
  const { k, isi } = useBahasa();
  const [d, setD] = useState<IsiTugas>(awal);
  const [mode, setMode] = useState<ModeBahasa>("id");
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
      <SakelarBahasa mode={mode} ubah={setMode} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.tugasEditor.identitas}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Medan
            mode={mode}
            id="nama"
            label={k.rpkps.tugasEditor.namaTugas}
            nilai={d.nama}
            nilaiEn={d.namaEn ?? ""}
            ubah={(v) => ubah("nama", v)}
            ubahEn={(v) => ubah("namaEn", v || null)}
            petunjuk={k.rpkps.tugasEditor.contohNama}
          />

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="jenis">{k.rpkps.tugasEditor.jenis}</Label>
              <Select
                value={d.jenis}
                onValueChange={(v) => ubah("jenis", (v ?? "INDIVIDU") as IsiTugas["jenis"])}
              >
                <SelectTrigger id="jenis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDU">{k.rpkps.tugas.individu}</SelectItem>
                  <SelectItem value="KELOMPOK">{k.rpkps.tugas.kelompok}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mingguMulai">{k.rpkps.tugasEditor.mingguMulai}</Label>
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
              <Label htmlFor="mingguSelesai">{k.rpkps.tugasEditor.mingguSelesai}</Label>
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
              <Label htmlFor="bobot">{k.rpkps.tugasEditor.bobot}</Label>
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
            <Label htmlFor="komponenNilaiId">{k.rpkps.tugasEditor.masukKomponen}</Label>
            <Select
              value={d.komponenNilaiId ?? "__kosong__"}
              onValueChange={(v) =>
                ubah("komponenNilaiId", !v || v === "__kosong__" ? null : v)
              }
            >
              <SelectTrigger id="komponenNilaiId">
                <SelectValue placeholder={k.rpkps.tugasEditor.belumDitentukan} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__kosong__">{k.rpkps.tugasEditor.pilihanKosong}</SelectItem>
                {komponenTersedia.map((komp) => (
                  <SelectItem key={komp.id} value={komp.id}>
                    {isi(k.rpkps.tugasEditor.pilihanKomponen, {
                      nama: komp.nama,
                      bobot: komp.bobot,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {k.rpkps.tugasEditor.komponenPetunjuk}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.tugasEditor.subDitagih}</CardTitle>
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
          <CardTitle className="text-base">{k.rpkps.tugasEditor.uraian}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Medan
            mode={mode}
            id="deskripsi"
            label={k.rpkps.tugasEditor.deskripsiTugas}
            baris={4}
            nilai={d.deskripsi}
            nilaiEn={d.deskripsiEn ?? ""}
            ubah={(v) => ubah("deskripsi", v)}
            ubahEn={(v) => ubah("deskripsiEn", v || null)}
            petunjuk={k.rpkps.tugasEditor.contohDeskripsi}
          />
          <Medan
            mode={mode}
            id="uraianTugas"
            label={k.rpkps.tugasEditor.uraianTeknis}
            baris={5}
            nilai={d.uraianTugas ?? ""}
            nilaiEn={d.uraianTugasEn ?? ""}
            ubah={(v) => ubah("uraianTugas", v || null)}
            ubahEn={(v) => ubah("uraianTugasEn", v || null)}
            petunjuk={k.rpkps.tugasEditor.contohUraian}
          />
          <Medan
            mode={mode}
            id="formatLuaran"
            label={k.rpkps.tugasEditor.formatLuaran}
            baris={4}
            nilai={d.formatLuaran ?? ""}
            nilaiEn={d.formatLuaranEn ?? ""}
            ubah={(v) => ubah("formatLuaran", v || null)}
            ubahEn={(v) => ubah("formatLuaranEn", v || null)}
            petunjuk={k.rpkps.tugasEditor.contohFormat}
          />
          <Medan
            mode={mode}
            id="ketentuanLain"
            label={k.rpkps.tugasEditor.ketentuanLain}
            baris={3}
            nilai={d.ketentuanLain ?? ""}
            nilaiEn={d.ketentuanLainEn ?? ""}
            ubah={(v) => ubah("ketentuanLain", v || null)}
            ubahEn={(v) => ubah("ketentuanLainEn", v || null)}
            petunjuk={k.rpkps.tugasEditor.contohKetentuan}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.tugasEditor.kriteriaJudul}</CardTitle>
          <CardDescription>{k.rpkps.tugasEditor.kriteriaKeterangan}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {d.kriteria.map((kr, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <Input
                  value={kr.indikator}
                  placeholder={k.rpkps.tugasEditor.contohIndikator}
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
                  value={kr.bobot}
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
                <TombolIkon
                  petunjuk={k.rpkps.tugasEditor.hapusIndikator}
                  onClick={() =>
                    ubah("kriteria", d.kriteria.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 />
                </TombolIkon>
              </div>

              {mode !== "id" ? (
                <div className="ml-7">
                  <Input
                    value={kr.indikatorEn ?? ""}
                    placeholder={k.dwibahasa.belumDiterjemahkan}
                    onChange={(e) =>
                      ubah(
                        "kriteria",
                        d.kriteria.map((x, j) =>
                          j === i ? { ...x, indikatorEn: e.target.value || null } : x,
                        ),
                      )
                    }
                  />
                </div>
              ) : null}

              <div className="ml-7 space-y-1.5">
                {kr.rincian.map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">•</span>
                    <Input
                      value={r}
                      className="h-8 text-sm"
                      placeholder={k.rpkps.tugasEditor.contohRincian}
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
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={k.rpkps.tugasEditor.hapusRincian}
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
                    </TombolIkon>
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
                  {k.rpkps.tugasEditor.tambahRincian}
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                ubah("kriteria", [...d.kriteria, { indikator: "", indikatorEn: null, rincian: [], rincianEn: [], bobot: 0 }])
              }
            >
              <Plus />
              {k.rpkps.tugasEditor.tambahIndikator}
            </Button>
            <span
              className={`text-sm font-medium tabular-nums ${kriteriaPas ? "text-success" : "text-destructive"}`}
            >
              {isi(k.rpkps.tugasEditor.total, {
                nilai: Math.round(totalKriteria * 100) / 100,
              })}
              {kriteriaPas ? "" : k.rpkps.tugasEditor.harus100}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.rpkps.tugasEditor.linimasaJudul}</CardTitle>
          <CardDescription>{k.rpkps.tugasEditor.linimasaKeterangan}</CardDescription>
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
                placeholder={k.rpkps.tugasEditor.contohTahapan}
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
                placeholder={k.rpkps.tugasEditor.contohAktivitas}
                onChange={(e) =>
                  ubah(
                    "linimasa",
                    d.linimasa.map((x, j) =>
                      j === i ? { ...x, aktivitas: e.target.value } : x,
                    ),
                  )
                }
              />
              {mode !== "id" ? (
                <>
                  <Input
                    className="w-52"
                    value={l.tahapanEn ?? ""}
                    placeholder={k.dwibahasa.belumDiterjemahkan}
                    onChange={(e) =>
                      ubah(
                        "linimasa",
                        d.linimasa.map((x, j) =>
                          j === i ? { ...x, tahapanEn: e.target.value || null } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    value={l.aktivitasEn ?? ""}
                    placeholder={k.dwibahasa.belumDiterjemahkan}
                    onChange={(e) =>
                      ubah(
                        "linimasa",
                        d.linimasa.map((x, j) =>
                          j === i ? { ...x, aktivitasEn: e.target.value || null } : x,
                        ),
                      )
                    }
                  />
                </>
              ) : null}
              <TombolIkon
                petunjuk={k.rpkps.tugasEditor.hapusTahapan}
                onClick={() => ubah("linimasa", d.linimasa.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </TombolIkon>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              ubah("linimasa", [
                ...d.linimasa,
                {
                  minggu: d.mingguMulai,
                  tahapan: "",
                  tahapanEn: null,
                  aktivitas: "",
                  aktivitasEn: null,
                },
              ])
            }
          >
            <Plus />
            {k.rpkps.tugasEditor.tambahTahapan}
          </Button>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={menunggu}
        onClick={() =>
          mulai(async () => {
            const h = await simpanTugas(
              tugasId,
              {
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
              },
              capVersi,
            );
            if (h.ok) {
              toast.success(h.pesan);
              router.refresh();
            } else toast.error(h.pesan);
          })
        }
      >
        {menunggu ? k.rpkps.tugasEditor.menyimpan : k.rpkps.tugasEditor.simpan}
      </Button>
    </div>
  );
}
